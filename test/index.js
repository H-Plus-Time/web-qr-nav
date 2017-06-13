// we want this as a monolithic entity

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
	img.src = './Qr-2.png';
	img.onload = function() {

		var width = Math.floor(this.width),
			height = Math.floor(this.height);

		var canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');
		ctx.drawImage(this, 0, 0, width, height);
		resample_single(canvas, 55, 55, true);
        var compCanvas = document.createElement('canvas');
        compCanvas.width = 256;
        compCanvas.height = 256;
        var compCtx = compCanvas.getContext('2d');
        compCtx.fillStyle = '#FFFFFF';
        compCtx.fillRect(0,0,256,256);
        compCtx.drawImage(canvas, 100.5, 100.5);
        compCtx.beginPath();
        compCtx.strokeStyle = "#000000";
        compCtx.lineWidth = 5;
        compCtx.ellipse(125.5, 125.5, 50.5, 50.5, 45 * Math.PI/180, 0, 2 * Math.PI);
        const ellStart = 125.5 - (50.5);
        compCtx.stroke();
        compCtx.lineWidth = 1;

        let qrs = webQR.detect(compCtx);
        for(var i = 0; i < qrs.length; i++) {
            for(var j = 0; j < qrs[i].length; j++) {
                var qr = qrs[i][j];
                console.log(qr.data);
                console.log(qr);
                // compCtx.strokeStyle = '#00FF00';
                // compCtx.beginPath();
                // var x0 = qr.locus.north_west.x + ellStart - 20;
                // var y0 = qr.locus.north_west.y + ellStart - 20;
                // compCtx.rect(x0, y0,
                //     (qr.locus.south_east.x - qr.locus.north_west.x)+5,
                //     (qr.locus.south_east.y - qr.locus.north_west.y)+5);
                // compCtx.stroke();
            }
        }
		document.body.appendChild(compCanvas);
    }
}

function testQRDistortions() {
    let container = document.createElement('image');
    let test_images = [
        "qrcode.png",
        "qrcode_45.png",
        "qrcode_180.png",
        "qrcode_perspective_071horiz.png",
        "qrcode_perspective_071vert.png",
        "qrcode_shear_125horiz.png",
        "qrcode_shear_125vert.png"
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

webQR().then((module) => {
    Object.assign(window, module);
    testWebQR();
    testQRDistortions()
})
