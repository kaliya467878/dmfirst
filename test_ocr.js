const Tesseract = require('tesseract.js');
const path = require('path');

async function runOCR() {
    const imgPath = path.join(__dirname, 'deposit_example.png');
    console.log('Running OCR on:', imgPath);
    
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(imgPath);
    console.log('=== OCR TEXT ===');
    console.log(ret.data.text);
    console.log('===============');
    await worker.terminate();
}

runOCR();
