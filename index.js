const path = require('path');
const fs = require('fs-extra');
const plist = require('plist');
const sharp = require('sharp');
const Promise = require('bluebird');

const argv = require('minimist')(process.argv.slice(2));

const PATTERN_RECT = /\{\{(\d+)\,(\d+)\}\,\{(\d+)\,(\d+)\}\}/;
const PATTERN_SIZE = /\{(\d+)\,(\d+)\}/;

let basename = argv._[0];

let plistFile = basename + '.plist',
    imageFile = basename + '.png';

function getRectFromString(string) {
  let matchData = PATTERN_RECT.exec(string);

  if (!matchData) {
    return null;
  }

  return {
    left: parseInt(matchData[1]),
    top: parseInt(matchData[2]),
    width: parseInt(matchData[3]),
    height: parseInt(matchData[4])
  };
}

function getSizeFromString(string) {
  let matchData = PATTERN_SIZE.exec(string);

  if (!matchData) {
    return null;
  }

  return {
    width: parseInt(matchData[1]),
    height: parseInt(matchData[2])
  };
}

function rotateRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.height,
    height: rect.width
  };
}

function processImageMap(imageMap) {
  return Promise.map(Object.keys(imageMap.frames), (imageKey) => {
    return processFrame(imageKey, imageMap.frames[imageKey]);
  });
}

function processFrame(imageKey, frameData) {
  console.log('processing:', imageKey);
  let rect = getRectFromString(frameData.frame);
  if (frameData.rotated) {
    rect = rotateRect(rect);
  }
  let colorRect = getRectFromString(frameData.sourceColorRect);
  let imageSize = getSizeFromString(frameData.sourceSize);
  let extension = {
    left: colorRect.left,
    top: colorRect.top,
    right: imageSize.width - colorRect.width - colorRect.left,
    bottom: imageSize.height - colorRect.height - colorRect.top
  };

  let pipeline = sharp(imageFile)
    .extract(rect);

  if (frameData.rotated) {
    pipeline.rotate(270);
  }

  pipeline.background({ r: 0, g: 0, b: 0, alpha: 0 })
    .extend(extension);

  return pipeline.toFile(path.join(basename, imageKey + '.png'))
    .catch((err) => {
      console.log('error:', imageKey, err);
    });
}

fs.mkdirp(basename)
  .then(() => {
    return fs.readFile(plistFile, 'utf-8');
  })
  .then((content) => {
    let imageMap = plist.parse(content);
    return processImageMap(imageMap);
  });
