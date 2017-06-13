# Web-QR
This library improves on the ZXing library by shortcircuiting the localization 
phase by means of circular markers (surrounding the QR Code), and enhancing the
candidate regions (contents of the circular markers) by means of hybrid
classical/example-based self-superimposition. The primary goal is to increase 
the mean detection range.

Assuming the spot size on a detector of the QR code's constituent blocks is 
not less than the Abbe limit (λ/2, so about 250 nm for green light), 
or significantly smaller than the pixel size of the detector (typically on 
the order of 1-2 microns), increasing the resolution of the detector will 
increase the mean detection range (assuming noise remains within an acceptable 
limit), as will computational resolution enhancement.

We could naively enhance the entire image before passing it to ZXing, however
this would incur a double performance penalty - the time taken to enhance the 
image (non-trivial), *and* an n^2 scaling of ZXing's execution time (a 4-fold
resolution increase in both axes would correspond to a 16-fold increase). 

To reduce the burden of resolution enhancement, we can couple our target codes 
with guide markers in the form of circles (akin to Australian or European speed
signs), and look for those first. This can be easily parallelized, provided the
ellipse detection algorithm used is tolerant to occlusion (or by using a second
set of grid-squares to account for the regions split by the first set).

See [web-yaed](https://github.com/H-Plus-Time/web-yaed) for the ellipse detection
implementation, and [web-zxing](https://github.com/H-Plus-Time/web-zxing) for
the fork of ZXing.

# Installation
```
npm install web-qr
```

or,

```
yarn add web-qr
```

# Usage

Source the build.js file like so:
```html
<script src="/path/to/build.js"></script>
```

Importantly, due to the way emscripten fetches WebAssembly files, the
.wasm files for both ZXing and webYaed (installed as dependencies
by web-qr) need to be in the same folder as the page that requires them - 
if your page is at /test/, your zxing.wasm and web-yaed.wasm files need to 
be at /test/zxing.wasm and /test/web-yaed.wasm, respectively.

The best way to handle this is to make a symlink for each of them.

After you've set up the above, you can instantiate the module like so:
```javascript
webQR().then((module) => {
    Object.assign(window, module);
    // or, manually assign each of the components:
    // window.webQR = module.webQR;
    // window.ZXing = module.ZXing;
    // window.webYaed = module.webYaed;
    // webQR.detect(CanvasContext2D: ctx)
})
```

The above copies the ZXing, webYaed and webQR objects onto the window object.
Note that all of the above, WebAssembly, promises, Object static methods
are relatively new features - support currently (May 11, 2017) hovers at ~52% 
globally (42% in Australia), so it is advised to do feature detection, and opt
for either omitting the feature entirely (performance for the ellipse detection
phase is not remotely acceptable in JS) or polyfilling with jsqrcode (note 
that this does not provide the localization improvement afforded by looking 
for guide ellipse markers). The relevant objects for feature detection are:
* window.WebAssembly (polyfills for this are extremely slow)
* window.Promise (this can be polyfilled in a performant manner)
* Object.assign (trivial to polyfill, not central to operating the library)

# Testing
For unit tests, run:
```bash
yarn test
# or npm test
```

# Develop
Changes to the top-level package (web-qr) only require a working install
of nodejs, and ```npm install```. However, the web-zxing and web-yaed 
dependencies are an entirely different ball of wax - these require emscripten,
which often needs to be built from source.

# Roadmap
* benchmark tests
* ~~unit tests~~
* Web Workers
* parametric testing
