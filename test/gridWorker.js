// import workerpool glue code, webQR
importScripts('./static/js/workerpool.js', './static/js/build.js');

async function initialize() {
    if(!self.webQR.detect) {
        console.log("starting initialization")
        Object.assign(self, await webQR());
        console.log("Finished initialization")
    } else {
        console.log("Already initialized.")
    }
}

async function detect(imageData) {
    if (!self.webQR.detect) {
        await initialize();
    }
    return self.webQR.detect(imageData);
}

async function test(globalDeps) {
    console.log(globalDeps);
}

// create a worker and register public functions
workerpool.worker({
  detect: detect,
  initialize: initialize,
  test: test
});