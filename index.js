import webYaed from 'web-yaed';
import ZXing from 'web-zxing';
var root;
// detect window obj
if(typeof(window) == 'undefined') {
    root = global;
} else {
    root = window;
}

const minFunc = (a,b) => Math.min(a,b);
const maxFunc = (a,b) => Math.max(a,b);

function ellipseBoundingBox(ellipse, width, height) {
    const maxAxis = Math.max(ellipse.a, ellipse.b);
    return {
        xMin: Math.round(Math.max(0, ellipse.xc - maxAxis)),
        yMin: Math.round(Math.max(0, ellipse.yc - maxAxis)),
        xMax: Math.round(Math.min(width, ellipse.xc + maxAxis)),
        yMax: Math.round(Math.min(height, ellipse.yc + maxAxis))
    };
}

function limitPrecision(ellipse, level) {
    let mag = Math.pow(10, level);
    Object.keys(ellipse).forEach(k => {
        ellipse[k] = Math.round(ellipse[k] * mag) / mag
    })
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
    const mem = root.webYaed._malloc(len);
    // memcpy pixelData onto allocated memory.
    root.webYaed.HEAPU8.set(pixelData, mem);
    let ellipsePointer = root.webYaed._detect(mem,width,height);
    // free explicitly malloc'd memory.
    root.webYaed._free(mem);
    let ellipseVector = new root.webYaed.VectorEllipse(ellipsePointer);
    // second, we extract the image segment coordinates of to the ellipses
    let regions = Array.from(new Array(ellipseVector.size()), (x,i) => i).map(i => {
        let ell = ellipseVector.get(i);
        let boundingBox = ellipseBoundingBox(ell, width, height);
        limitPrecision(ell, 4);
        return {
            ellipse: ell,
            boundingBox: boundingBox
        }
    });
    // free memory associated with the vector and its children.
    // Note that this doesn't delete the JS representation of children
    // with defined value_object bindings
    ellipseVector.delete();
    // third, we run self-superimposition enhancement
    // fourth, we run ZXing._detect_qr() on each enhanced segment
    let results = regions.map((region) => {
        let seg = region.boundingBox;
        // calculate width and height for getImageData
        // actually takes an x0,y0,width,height
        let segHeight = seg.yMax - seg.yMin;
        let segWidth = seg.xMax - seg.xMin;
        let pixelData = ctx.getImageData(seg.xMin, seg.yMin, segWidth, segHeight).data;
        ctx.strokeStyle = '#FF0000';
        ctx.strokeRect(seg.xMin, seg.yMin, segWidth, segHeight);

        let subLen = pixelData.length;
        // allocate memory
        let segmentMem = root.ZXing._malloc(subLen);
        root.ZXing.HEAPU8.set(pixelData, segmentMem);
        let resultsPointer = root.ZXing._decode_qr(segmentMem, segWidth, segHeight);
        let segResults = new root.ZXing.VectorZXingResult(resultsPointer);
        let qrDataArr =  Array.from(new Array(segResults.size()), (x,i) => i)
            .map(i => segResults.get(i));
        // deallocate the vector.
        segResults.delete();
        root.ZXing._free(segmentMem);
        return Object.assign(region, {qrs: qrDataArr});
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