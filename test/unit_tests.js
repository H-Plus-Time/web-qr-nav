const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
 const fs = require('fs');
chai.use(chaiAsPromised);
chai.should();
const webQR = require('../dist/build.js');
const readFile = require('fs-readfile-promise');
const Canvas = require('canvas');
const Image = Canvas.Image;

function withinBounds(input, expected, tolerance) {
    return (input > expected * (1.0 - tolerance) &&
            input < expected * (1.0 + tolerance))
}
function LocusWithinBounds(input, expected, tolerance) {
    return Object.keys(input).map((k) => {
        return (withinBounds(input[k].x, expected[k].x, tolerance) &&
                withinBounds(input[k].y, expected[k].y, tolerance))
    }).every(x => x)
}

async function testImageLoader(path) {
    img = new Image;
    img.src = await readFile(path);
    canvas = new Canvas(img.width, img.height);
    ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    return global.webQR.detect(ctx);
}

describe("WebQR", function() {
    before(async function() {
        this.timeout(10000);
        Object.assign(global, await webQR());
    })
    describe("#detect", async function() {
        it("should return [] when presented with a blank image", function() {
            return testImageLoader("test/empty.jpg").should.eventually.deep.equal([])
        })
        it("should return an object with the keys: boundingBox, qrs, ellipse", function() {
            return testImageLoader("test/qrcode.png").then(results => {
                return results[0]
            }).should.eventually.have.all.keys(['boundingBox', 'qrs', 'ellipse'])
        })
        // let testManifest = JSON.parse(fs.readFileSync('./test/test_manifest.json'));
        // testManifest.forEach(function(test) {
        //     // expected is arr of {ellipse, boundingBox, qrs} objects
        //     it(`should return ${test.expected} for ${test.path}`, function() {
        //         return testImageLoader("test/" + test.path).should
        //             .eventually.deep.equal(test.expected)
        //     })
        // })

        describe("parameter range testing", async function() {
            let testFiles = fs.readdirSync('./test/images/');
            console.log(testFiles);
            for (let path of testFiles) {
                console.log(path);
                let results = await testImageLoader(`./test/images/${path}`);
                console.log(results);
            }
            false.should.be.false;
        })
    })
})