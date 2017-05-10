// we want this as a monolithic entity


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
    const mem = webYaed._malloc(len);
    // memcpy pixelData onto allocated memory.
    webYaed.HEAPU8.set(pixelData, mem);
    let ellipsePointer = webYaed._detect(mem,width,height);
    // free explicitly malloc'd memory.
    webYaed._free(mem);
    let ellipseVector = new webYaed.VectorEllipse(ellipsePointer);
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
        let segmentMem = ZXing._malloc(subLen);
        ZXing.HEAPU8.set(pixelData, segmentMem);
        let resultsPointer = ZXing._decode_qr(segmentMem, segWidth, segHeight);
        let segResults = new ZXing.VectorZXingResult(resultsPointer);
        let qrDataArr =  Array.from(new Array(segResults.size()), (x,i) => i)
            .map(i => segResults.get(i).data);
        // deallocate the vector.
        segResults.delete();
        return qrDataArr;
    })
    return results;
}

function resample_single(canvas, width, height, resize_canvas) {
    var width_source = canvas.width;
    var height_source = canvas.height;
    width = Math.round(width);
    height = Math.round(height);

    var ratio_w = width_source / width;
    var ratio_h = height_source / height;
    var ratio_w_half = Math.ceil(ratio_w / 2);
    var ratio_h_half = Math.ceil(ratio_h / 2);

    var ctx = canvas.getContext("2d");
    var img = ctx.getImageData(0, 0, width_source, height_source);
    var img2 = ctx.createImageData(width, height);
    var data = img.data;
    var data2 = img2.data;

    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            var x2 = (i + j * width) * 4;
            var weight = 0;
            var weights = 0;
            var weights_alpha = 0;
            var gx_r = 0;
            var gx_g = 0;
            var gx_b = 0;
            var gx_a = 0;
            var center_y = (j + 0.5) * ratio_h;
            var yy_start = Math.floor(j * ratio_h);
            var yy_stop = Math.ceil((j + 1) * ratio_h);
            for (var yy = yy_start; yy < yy_stop; yy++) {
                var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
                var center_x = (i + 0.5) * ratio_w;
                var w0 = dy * dy; //pre-calc part of w
                var xx_start = Math.floor(i * ratio_w);
                var xx_stop = Math.ceil((i + 1) * ratio_w);
                for (var xx = xx_start; xx < xx_stop; xx++) {
                    var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
                    var w = Math.sqrt(w0 + dx * dx);
                    if (w >= 1) {
                        //pixel too far
                        continue;
                    }
                    //hermite filter
                    weight = 2 * w * w * w - 3 * w * w + 1;
                    var pos_x = 4 * (xx + yy * width_source);
                    //alpha
                    gx_a += weight * data[pos_x + 3];
                    weights_alpha += weight;
                    //colors
                    if (data[pos_x + 3] < 255)
                        weight = weight * data[pos_x + 3] / 250;
                    gx_r += weight * data[pos_x];
                    gx_g += weight * data[pos_x + 1];
                    gx_b += weight * data[pos_x + 2];
                    weights += weight;
                }
            }
            data2[x2] = gx_r / weights;
            data2[x2 + 1] = gx_g / weights;
            data2[x2 + 2] = gx_b / weights;
            data2[x2 + 3] = gx_a / weights_alpha;
        }
    }
    //clear and resize canvas
    if (resize_canvas === true) {
        canvas.width = width;
        canvas.height = height;
    } else {
        ctx.clearRect(0, 0, width_source, height_source);
    }

    //draw
    ctx.putImageData(img2, 0, 0);
}

function testWebQR() {
	var img = new Image;
	img.src = './real-world-merge.jpg';
	img.onload = function() {

		var width = Math.floor(this.width),
			height = Math.floor(this.height);

		var canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');
		ctx.drawImage(this, 0, 0, width, height);
		// resample_single(canvas, 220, 220, true);
        // var compCanvas = document.createElement('canvas');
        // compCanvas.width = 256;
        // compCanvas.height = 256;
        // var compCtx = compCanvas.getContext('2d');
        // compCtx.fillStyle = '#FFFFFF';
        // compCtx.fillRect(0,0,256,256);
        // compCtx.drawImage(canvas, 0.5, 0.5);
        // compCtx.beginPath();
        // compCtx.strokeStyle = "#000000";
        // compCtx.lineWidth = 1;
        // compCtx.ellipse(125.5, 125.5, 50.5, 50.5, 45 * Math.PI/180, 0, 2 * Math.PI);
        // compCtx.stroke();
        let qrs = detectQRs(ctx);
        console.log(qrs);
		document.body.appendChild(canvas);
        //
    }
}
