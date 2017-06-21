// we want this as a monolithic entity

let pool = workerpool.pool('./gridWorker.js');

async function poolBootstrap() {
    let numWorkers = navigator.hardwareConcurrency - 1;
    return Promise.all(Array(numWorkers).map(i => pool.exec('initialize')))
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

function shiftEllipse(ell, xShift, yShift) {
    ell.xc = ell.xc + xShift;
    ell.yc = ell.yc + yShift;
    return ell;
}

function shiftBoundingBox(boundingBox, xShift, yShift) {
    return {
        xMin: boundingBox.xMin+xShift, xMax: boundingBox.xMax+xShift,
        yMin: boundingBox.yMin+yShift, yMax: boundingBox.yMax+yShift
    }
}

function shiftQR(qr, xShift, yShift) {
    // qr.locus = qr.locus.map(coord => {

    // })
    return qr;
}

async function detectGridWise(ctx, width, height, xDivisions, yDivisions, exhaustive=false) {
    var bufferResults = []
    var results = []
    let gridWidth = width/xDivisions;
    let gridHeight = height/yDivisions;
    let evenX = xDivisions % 2 == 0 ? true : false;
    let evenY = yDivisions % 2 == 0 ? true : false;
    console.log(gridWidth, gridHeight);
    let start = performance.now();
    // TODO: optimize to par-for over center, followed by horizon, then 
    // in interleaved reverse 2D order for each quadrant (skipping the center)
    for(let i = 0; i < width; i+= gridWidth) {
        for(let j = 0; j < height; j+= gridHeight) {
            // push to results and await en-masse
            let imageData = ctx.getImageData(i, j, gridWidth, gridHeight);
            bufferResults.push(pool.exec('detect',[imageData]).then(results => {
                return results.map(res => {
                    return {
                        ellipse: shiftEllipse(res.ellipse, i, j),
                        boundingBox: shiftBoundingBox(res.boundingBox, i, j),
                        qrs: res.qrs.map(qr => shiftQR(qr, i, j))
                    }
                })
            }));
        }
        let rowResults = await Promise.all(bufferResults);
        gridsWithQRs = rowResults.reduce((flat, next) => flat.concat(next), [])
            .filter((gridSquare) => {
            return Object.keys(gridSquare).indexOf('qrs') != -1;
        })
        if(gridsWithQRs.length > 0 && !exhaustive) {
            // A QR code has been found. return eagerly.
            return gridsWithQRs;
        }
        results = results.concat(rowResults);
        bufferResults = [];
    }
    console.log(performance.now() - start);
    return results;
}

function loadImage(path) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = function() {resolve({image: this, status: 'ok'})};
        img.onerror = function() { resolve({image: this, status: 'error'})};

        img.src = path;
    });
}


function drawBoundingBox(ctx, boundingBox) {
    ctx.strokeStyle = "#ff0000";
    let width = boundingBox.xMax - boundingBox.xMin;
    let height = boundingBox.yMax - boundingBox.yMin;
    ctx.rect(boundingBox.xMin, boundingBox.yMin, width, height);
    ctx.stroke();
}

function testWebQR(path, exhaustive=false) {
	return loadImage(path).then(resp => {
        console.log(resp);
        let image = resp.image;
		var width = Math.floor(image.width),
			height = Math.floor(image.height);

		var canvas = document.createElement('canvas');
		canvas.style.display = 'block';
        var newWidth = height/2, newHeight = height/2;
		canvas.width = newWidth;
		canvas.height = newHeight;
        console.log(newWidth,newHeight);
		var ctx = canvas.getContext('2d');
		ctx.drawImage(image, (width-height)/2, 0, height, height, 0, 0, newWidth, newHeight);
        
        // to do a 'one giant image' scan:
        // let imageData = ctx.getImageData(0,0,newWidth, newHeight);
        // return pool.exec('detect', [imageData]).then(results => {
        //     console.log(results);
        //     results.forEach(res => drawBoundingBox(ctx, res.boundingBox))
        // })

        // however, we want to keep the image size down
        // note that the first run on a multi-worker run is quite slow
        // due to the compilation of the WebAssembly modules
        return detectGridWise(ctx, newWidth, newHeight, 1,1, exhaustive).then(resp => {
            resp.reduce((flat, next) => flat.concat(next), []).forEach(res => {
                canvas.width = canvas.width / 8;
                canvas.height = canvas.height / 8;
                document.appendChild(canvas);
                drawBoundingBox(ctx, res.boundingBox)
                if(res.qrs && res.qrs.length > 0) {
                    ctx.fillStyle = "#000000";
                    ctx.font = "30px Arial";
                    let offsetX = res.boundingBox.xMin + res.qrs[0].locus.north_west.x;
                    let offsetY = res.boundingBox.yMax + res.qrs[0].locus.north_west.y;
                    ctx.fillText(res.qrs[0].data, offsetX, offsetY);
                }
            })
            return {results: resp, path: path}
            
        })
    })
}

function testQRDistortions() {
    let container = document.createElement('image');
    let test_images = [

    ];
    test_images.map(path => {
        img = new Image();
        img.addEventListener('load', function() {
            cvs = document.createElement('canvas');
            cvs.width = 1500;
            cvs.height = 1500;
            ctx = cvs.getContext('2d');
            ctx.drawImage(this, 0, 0);
            let qrs = webQR.detect(ctx, "blue");
            console.log(qrs);
            for(var i = 0; i < qrs.length; i++) {
                for(var j = 0; j < qrs[i].length; j++) {
                    var qr = qrs[i][j];
                    console.log(qr.data);
                    console.log(qr);
                }
            }
            delete cvs;
            delete this;
        });
        img.src = path;
    })
}

poolBootstrap().then(resp => {
    console.log(resp)
    return fetch('./image_manifest.json').then(res => res.json())
}).then(images => {
    return Promise.all(images.map(path => {
        if (path.indexOf("multi") != -1) {
            return testWebQR(path, true)
        } else {
            return testWebQR(path);
        }
    }))
}).then(testResults => {
    console.log(testResults)
    pool.clear();
})
