const fs = require('fs');
const webQR = require('../dist/build.js');
const readFile = require('fs-readfile-promise');
const Canvas = require('canvas');
const Image = Canvas.Image;
const NS_PER_S = 1e9;
async function main() {
    Object.assign(global, await webQR());
    img = new Image;
    img.src = await readFile('./test/qrcode.png');
    canvas = new Canvas(img.width, img.height)
    ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    let start = process.hrtime();
    global.webQR.detect(ctx);
    let diff = process.hrtime(start);
    console.log(((diff[0]*NS_PER_S + diff[1])/NS_PER_S).toString() + "s")
}

async function testImageLoader(path) {
    img = new Image;
    img.src = await readFile(path);
    canvas = new Canvas(img.width, img.height)
    ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    return global.webQR.detect(ctx);
}

async function test() {
    Object.assign(global, await webQR());
let testFiles = fs.readdirSync('./test/images/');
console.log(testFiles);
for (let path of testFiles) {
    console.log(path);
    let results = await testImageLoader(`./test/images/${path}`);
    console.log(results);
}
}
test()