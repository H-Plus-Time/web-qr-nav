const fs = require('fs');

let images = fs.readdirSync('./test/images/').filter(p => p.endsWith('jpg')).map(path => `images/${path}`);
fs.writeFileSync('./test/image_manifest.json', JSON.stringify(images, null, '\t'));
