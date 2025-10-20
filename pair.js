const { giftedid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { Storage, File } = require("megajs");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@adiwajshing/baileys");

function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'techobed4@gmail.com',
            password: 'Trippleo1802obed'
        }).ready;
        console.log('Mega storage initialized.');
        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }
        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;
        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = giftedid();
    let num = req.query.number;

    // Hakikisha namba iko sahihi
    if (!num) {
        return res.status(400).send({ error: "Namba haipo" });
    }

    async function GIFTED_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            let Gifted = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                version: [2, 3000, 1017542762] // Toleo thabiti la WhatsApp
            });

            if (!Gifted.authState.creds.registered) {
                await delay(2000); // Ongeza delay kidogo
                num = num.replace(/[^0-9]/g, '');
                
                // Weka timeout kwa pairing code request
                const code = await Promise.race([
                    Gifted.requestPairingCode(num),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Pairing code request timeout')), 30000)
                    )
                ]);
                
                console.log(`Your Code: ${code}`);
                if (!res.headersSent) {
                    res.send({ code: code });
                }
            }

            Gifted.ev.on('creds.update', saveCreds);

            Gifted.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                console.log('Connection update:', connection);

                if (connection === "open") {
                    console.log('Connected successfully!');
                    
                    await delay(3000); // Pungua delay kidogo
                    
                    const filePath = __dirname + `/temp/${id}/creds.json`;
                    if (!fs.existsSync(filePath)) {
                        console.error("File not found:", filePath);
                        return;
                    }

                    try {
                        const megaUrl = await uploadCredsToMega(filePath);
                        const sid = megaUrl.includes("https://mega.nz/file/")
                            ? 'http://session.blaze.xibs.space/' + megaUrl.split("https://mega.nz/file/")[1]
                            : 'Error: Invalid URL';

                        console.log(`Session ID: ${sid}`);

                        // Tumia user.id kwa uhakika zaidi
                        const userJid = Gifted.user?.id;
                        if (!userJid) {
                            console.error('User ID not available');
                            return;
                        }

                        const sidMsg = await Gifted.sendMessage(
                            userJid,
                            {
                                text: sid,
                                contextInfo: {
                                    mentionedJid: [userJid],
                                    forwardingScore: 999,
                                    isForwarded: true
                                }
                            },
                            {
                                disappearingMessagesInChat: true,
                                ephemeralExpiration: 86400
                            }
                        );

                        const GIFTED_TEXT = `
*╭───* ▣▣▣▣▣▣▣▣▣▣▣▣
*│  B*   *_USE LINK ABOVE_*
*│  L*  _UR CONNECTED_ 
*│  A*  _DEPLOY UR BOT_ 
*│  Z*  _NOW, BEY_ 
*│  E*         
*╰───*▣▣▣▣▣▣▣▣▣▣▣▣
                   *◥XIBS◤*`;

                        await Gifted.sendMessage(
                            userJid,
                            {
                                text: GIFTED_TEXT,
                                contextInfo: {
                                    mentionedJid: [userJid],
                                    forwardingScore: 999,
                                    isForwarded: true
                                }
                            },
                            {
                                quoted: sidMsg,
                                disappearingMessagesInChat: true,
                                ephemeralExpiration: 86400
                            }
                        );

                        await delay(100);
                        Gifted.end(); // Tumia .end() badala ya .ws.close()
                        removeFile('./temp/' + id);
                        
                    } catch (uploadError) {
                        console.error('Upload error:', uploadError);
                    }

                } else if (connection === "close") {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    console.log('Connection closed, reconnect:', shouldReconnect);
                    
                    if (shouldReconnect) {
                        await delay(5000);
                        GIFTED_PAIR_CODE();
                    } else {
                        console.log('Authentication error, no reconnection');
                        removeFile('./temp/' + id);
                    }
                }
            });

        } catch (err) {
            console.error("Service Error:", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.status(500).send({ error: "Service is Currently Unavailable", details: err.message });
            }
        }
    }

    await GIFTED_PAIR_CODE();
});

module.exports = router;
