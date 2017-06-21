# General research notes

Resampling very high resolution images (4Kx5K) pretty much doesn't work due to sampling artefacts (who knew?).

Low order resampling is still effective for short-range high-resolution images.

Distributing a grid of image segments (say, 512x512) to a pool of web workers is the only viable way to find small features in large images.

Problem: excessive copying of pixel buffers hither and thither.
Solution: SharedArrayBuffer!
1. Copy canvas pixel data array to sharedArrayBuffer.
2. a. If operating on full-width slices, just generate offsets.
2. b. More likely, operating on partial-width slices/grids:
    For each row, each worker starts at width/n * i (where n is the number of 
    grid-squares per width, and i is the order of the worker); column indexing
    is as normal (offset+x), but row indexing must map y to y*n
Verdict: SharedArrayBuffer not implemented yet :-/.

## Transferrable objects
If the object being postMessaged from the main thread (or anoth worker) to a child worker is Transferrable (see (MDN: Transferable)[https://developer.mozilla.org/en-US/docs/Web/API/Transferable]) - afaik large ArrayBuffer-like objects such as ImageBitmap, ImageData - the VM does not copy the object from one environment to the other; instead, it reassigns ownership from the sender to the receiver. In lieu of direct shared memory, this is a nice intermediary as image analysis procedures that return summaries of the input image (say, count of the number of circles present) only take a tiny margin more than their shared memory counterparts, and image pipelines can avoid half the copies.

## Domain-specific optimizations
It is a reasonable assumption that the users of an image recognition software skew the search space toward the horizon and the center of the view-field - both via experience (street-signs are tightly clustered around the horizon, traffic light buttons at waist-height) and via their own senses (when trying to scan a QR code as a sighted individual). Under that assumption, a routine that scans the search space in grid squares could return early (where an exhaustive search isn't required) if it prioritised the center and/or horizon line of the search space. Even in parallel situations, this would produce benefits, given the shallow pipelines available (particularly in mobile devices). In the case of webQR, awaiting the largest central section (just the central square, or a block of 2x2) of size less than or equal to the maximum number of workers (# cpu cores - 1), followed by looping over each quadrant from the center out, results in the maximum potential speed boost.

## outstanding goals
test rotational invariance
test range (zero perspective shift, rotation).
test multiple detection

prepped talking points:
early exit

todos:
remember previously found 

testing at 3m for perspective distortion.
single variable testing

Thursday demo:
multiple qr nav codes at multiple different presentation angles and distances.
still images, nice report output. Annotate both bounding boxes and URLs.

MVP: 
Bounding box in debugging video feed
deduplicate ellipses/qrcodes

critical bug: memory leak in either webYaed or ZXing. MUST FIX by Thursday