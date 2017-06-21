import webYaed from 'web-yaed';
import ZXing from 'web-zxing';
var root;
// detect window obj
if(typeof(self) == 'undefined') {
    root = global;
} else {
    // operating inside a Web Worker
    root = self;
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

function getPixelIdx(width, height, x,y) {
    return ((y*width+x)*4);
}

// canvas isn't available in web workers, but ImageData is
// therefore, it is convenient to polyfill the getImageData method of Canvas
function getImageData(imageData, sourceX, sourceY, destWidth, destHeight) {
    let sourceWidth = imageData.width;
    let sourceHeight = imageData.height;
    let pixelData = imageData.data;
    let dest = new Uint8ClampedArray(destWidth*destHeight*4);
    // copy over line by line
    for(let j = 0; j < destHeight; j++) {
        let rowWidth = destWidth*4;
        let destOffset = j*rowWidth;
        let sourceOffset = getPixelIdx(sourceWidth, sourceHeight, sourceX, j+sourceY);
        dest.set(pixelData.slice(sourceOffset, sourceOffset+rowWidth), destOffset);
    }
    return dest;
}

function detectQRs(imageData) {
    let width = imageData.width;
    let height = imageData.height;
    let pixelData = imageData.data;
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
        console.log(region.ellipse);
        let seg = region.boundingBox;
        // calculate width and height for getImageData
        // actually takes an x0,y0,width,height
        let segHeight = seg.yMax - seg.yMin;
        let segWidth = seg.xMax - seg.xMin;
        let pixelData = getImageData(imageData, seg.xMin, seg.yMin, segWidth, segHeight);

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