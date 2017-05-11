import webYaed from 'web-yaed';
import ZXing from 'web-zxing';

const minFunc = (a,b) => Math.min(a,b);
const maxFunc = (a,b) => Math.max(a,b);

function ellipseBoundingBox(ellipse, width, height) {
    const maxAxis = Math.max(ellipse.a, ellipse.b);
    console.log(ellipse);
    return {
        xMin: Math.round(Math.max(0, ellipse.xc - maxAxis)),
        yMin: Math.round(Math.max(0, ellipse.yc - maxAxis)),
        xMax: Math.round(Math.min(width, ellipse.xc + maxAxis)),
        yMax: Math.round(Math.min(height, ellipse.yc + maxAxis))
    };
}

function detectQRs(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    let pixelData = ctx.getImageData(0,0,width,height).data;
    // first, we execute ellipse detection
    const len = pixelData.length;
    // never trust an emscripten module to hand-hold re memory management.
    // make it explicit, allocate memory for dynamicAlloc'd variables, in this
    // case an unsigned char *.
    const mem = window.webYaed._malloc(len);
    // memcpy pixelData onto allocated memory.
    window.webYaed.HEAPU8.set(pixelData, mem);
    let ellipsePointer = window.webYaed._detect(mem,width,height);
    // free explicitly malloc'd memory.
    window.webYaed._free(mem);
    let ellipseVector = new window.webYaed.VectorEllipse(ellipsePointer);
    // second, we extract the image segment coordinates of to the ellipses
    let regions = Array.from(new Array(ellipseVector.size()), (x,i) => i)
        .map(i => ellipseBoundingBox(ellipseVector.get(i), width, height));
    ellipseVector.delete();
    // third, we run self-superimposition enhancement
    // fourth, we run ZXing._detect_qr() on each enhanced segment
    let results = regions.map((seg) => {
        // calculate width and height for getImageData
        // actually takes an x0,y0,width,height
        let segHeight = seg.yMax - seg.yMin;
        let segWidth = seg.xMax - seg.xMin;
        let pixelData = ctx.getImageData(seg.xMin, seg.yMin, segWidth, segHeight).data;
        ctx.strokeStyle = '#FF0000';
        ctx.strokeRect(seg.xMin, seg.yMin, segWidth, segHeight);

        let subLen = pixelData.length;
        // allocate memory
        let segmentMem = window.ZXing._malloc(subLen);
        window.ZXing.HEAPU8.set(pixelData, segmentMem);
        let resultsPointer = window.ZXing._decode_qr(segmentMem, segWidth, segHeight);
        let segResults = new window.ZXing.VectorZXingResult(resultsPointer);
        let qrDataArr =  Array.from(new Array(segResults.size()), (x,i) => i)
            .map(i => segResults.get(i));
        // deallocate the vector.
        segResults.delete();
        window.ZXing._free(segmentMem);
        return qrDataArr;
    })
    return results;
}

var module_bundle = {"webQR": {"detect": detectQRs}};

function instantiateModule(module, name) {
    return new Promise(function(resolve, reject) {
        module_bundle[name] = module({postRun: resolve});
    })
}

export default function() {
    return instantiateModule(ZXing, "ZXing").then(() => {
        return instantiateModule(webYaed, "webYaed");
    }).then(() => {
        return module_bundle;
    })
}