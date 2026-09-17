import WhatsappJs from 'whatsapp-web.js';
import QRpkg from 'qrcode-terminal';
import FileSystem from 'fs';
import Path from 'path';
import Axios from 'axios';
import TesseractOCR from 'tesseract.js';
import { debug } from 'console';

const { Client, LocalAuth } = WhatsappJs;
const qrcode = QRpkg;
const fs = FileSystem;
const path = Path;
const axios = Axios;
const {createWorker} = TesseractOCR;


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});


client.initialize();

client.on('auth_failure', msg => {console.error('Authentication failed',msg) } );

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('READY');
});

//// Use whatsappbot to receive message

let _botSignature = 'GeneratedResponse:\n';
//// performanter wenn TesseractWorker nicht bei jedem Bild erzeugt werden muss
let worker = await createWorker('deu');

client.on('message_create', async (message) => {

    // ignoriere generierte antworten da sonst recursion
    if(message.fromMe) {
        if (message.body.startsWith(_botSignature)) {
            return;
        }
    }

    let initalResponse = GenerateInitalResponse(message);
    let answer = "";
    //Beende Ineraktion da kein Bild zum Verarbeiten
    if (!message.hasMedia) {
        console.log("Kein Anhang");
        answer = initalResponse +`\nKein Anhang`;
        await message.reply(answer);
        return;
    }else{
        if (!message.type === 'image') {  
            console.log("Anhang war kein Bild");
            answer = initalResponse +`\nKein Bild im Anhang`;
            await message.reply(answer);
            return;
        }
    }

    answer = initalResponse +`\nVersuche Bild im Anhang zu verarbeiten`;
  ///  await message.reply(answer);
    console.log(answer);

    // Speichern des Bildes
    // Buffer outside scope because it wont survive the try-catch-block.... 
    let imageBuffer;
    try {

        /** Fix für den fehlerhaften Download von Bildern 
         * Edited Message.js
         * node_modules/whatsapp-web.js/src/structures/Message.js
         * 
         * change
         * 
         * this.id = data.id;
         * 
         * to
         * 
         * this.id = data.id;
         * if (this.id && !this.id._serialized && this.id.$1) {
         *      this.id._serialized = this.id.$1;
         * }
        */

        let imageFiles = await message.downloadMedia();

        if (!imageFiles) {
            console.log("Fehler beim Download");
            return;
        }

        let extention = imageFiles.mimetype.split('/')[1] || 'jpg';
        let filename = `Lieferschein_${ConvertUnixDateTimeForSaving(Date.now())}.${extention}`;
        let filepath = `/home/daneub/rechnungen/${filename}`;

        imageBuffer = Buffer.from(imageFiles.data, 'base64');
        fs.writeFileSync(filepath, imageBuffer);

        console.log(`Gespeichert: ${filename}`);

    } catch (saveFileError) {
        console.log('SaveFile Error\n', saveFileError);
    }

    //// Use tesseract to read to OCR
    let recognizedText;
    try {
        const {data} = await worker.recognize(imageBuffer, {}, {blocks: true});

        await worker.terminate();

        ////console.log('ORC Text:\n', data.text);

        recognizedText = data;

        // // answer = GenerateOCRMessage(message, text);
        // // await message.reply(answer);

    } catch (tesseractError) {
        console.log('tesseractError\n', tesseractError);
    }

    ist alles ein block -.-
    for (const block of recognizedText.blocks ?? []) {
        console.log(block);
        let x = block.text;
        let y = block.bbox;

        console.log(`text:\n ${x}\n bbox: ${y}`);
    }

    //// Diese herangehensweise würde spezielle Formulae erfordern die alle analysiert und geclustert werden müssten

    //// /../i sucht nach lowercase uppercase und auch zusamenhängende wörter z.B. auch "Empfänger"liste
    //// Blocks durchsuchen 

    // try {

    //     const response = await axios.post(
    //         'http://192.168.50.178:5678/webhook-test/rechnung',
    //         {
    //             gruppe: message.from,
    //             datei: filename,
    //             zeit: Date.now()
    //         }
    //     );

    //     console.log('✅ An n8n gesendet');
    //     console.log(response.data);

    // } catch (err) {

    //     console.log('FEHLER');

    //     if (err.response) {
    //         console.log(err.response.status);
    //         console.log(err.response.data);
    //     } else {
    //         console.log(err.message);
    //     }
    // }
});

function GenerateInitalResponse(message) {
    let messageDate = ConvertUnixDateTime(message.timestamp);
    let received_msg_text = ` Nachricht um ${messageDate} \n` 
        + `mit Inhalt: \n` 
        + `${message.body} \n` 
        + `erhalten \n`;

        return _botSignature + received_msg_text;
}

function GenerateOCRMessage(message, ocrResult) {
    let messageDate = ConvertUnixDateTime(message.timestamp);
    let received_msg_text = ` Bild verarbeitet um ${messageDate} \n` 
        + `OCR hat erkannt: \n` 
        + `${ocrResult} \n`;

        return _botSignature + received_msg_text;
}

/// Converirt Date.timestamp to German time format (DD.MM.YYYY, HH:MM:SS) for Botresponses
function ConvertUnixDateTime(timestamp) {
    // Convert Unix Time from MilliSeconds to seconds. to german de-DE format and replace Timeseperator T with blank space
    return new Date(timestamp*1000).toLocaleString('de-DE').replace('T', ' ');
}


/// Converirt Date.timestamp to Swedisch time format (YYYY-MM-DD HH-MM-SS) for File Savings
function ConvertUnixDateTimeForSaving(timestamp) {
    // Convert Unix Time from MilliSeconds to seconds. to swedish sv-SE format and replace Timeseperator T with blank space
    return new Date(timestamp*1000).toLocaleString('sv-SE').replace('T', ' ').replace(':', '-');
}