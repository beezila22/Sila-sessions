const { giftedid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const pn = require ('awesome-phonenumber');
const crypto = require ('crypto');
const { Storage, File } = require("megajs");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

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

    // Hakikisha folder ya temp ipo
    if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true });
    }

    async function GIFTED_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            let Gifted = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
                version: [2, 3000, 1017542762]
            });

            // Ongeza event listeners kabla ya pairing code
            Gifted.ev.on('creds.update', saveCreds);

            Gifted.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;
                console.log('🔗 Connection state:', connection);

                if (connection === "open") {
                    console.log('✅ Connected successfully!');
                    
                    await delay(5000);
                    
                    const filePath = __dirname + `/temp/${id}/creds.json`;
                    if (!fs.existsSync(filePath)) {
                        console.error("❌ File not found:", filePath);
                        return;
                    }

                    try {
                        const megaUrl = await uploadCredsToMega(filePath);
                        const sid = megaUrl.includes("https://mega.nz/file/")
                            ? 'http://session.blaze.xibs.space/' + megaUrl.split("https://mega.nz/file/")[1]
                            : 'Error: Invalid URL';

                        console.log(`📱 Session ID: ${sid}`);

                        const userJid = Gifted.user?.id;
                        if (!userJid) {
                            console.error('❌ User ID not available');
                            return;
                        }

                        // Tumia method rahisi ya kutuma message
                        await Gifted.sendMessage(userJid, { 
                            text: `Session URL: ${sid}\n\nUse this link to deploy your bot.` 
                        });

                        await delay(1000);
                        
                        // Futa session files na close connection
                        removeFile('./temp/' + id);
                        await Gifted.end();
                        
                    } catch (uploadError) {
                        console.error('❌ Upload error:', uploadError);
                    }

                } else if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log('🔒 Connection closed, status:', statusCode);
                    
                    if (statusCode !== 401) {
                        console.log('🔄 Attempting reconnect...');
                        await delay(3000);
                        GIFTED_PAIR_CODE();
                    } else {
                        console.log('❌ Authentication failed, no reconnect');
                        removeFile('./temp/' + id);
                    }
                }
            });

            // Sasa omba pairing code
            if (!Gifted.authState.creds.registered) {
                await delay(3000);
                num = num.replace(/[^0-9]/g, '');
                
                console.log('📞 Requesting pairing code for:', num);
                
                try {
                    const code = await Gifted.requestPairingCode(num);
                    console.log(`✅ Pairing Code: ${code}`);
                    
                    if (!res.headersSent) {
                        res.send({ 
                            success: true,
                            code: code,
                            message: "Pairing code generated successfully"
                        });
                    }
                } catch (pairError) {
                    console.error('❌ Pairing code error:', pairError);
                    if (!res.headersSent) {
                        res.status(500).send({ 
                            error: "Failed to get pairing code", 
                            details: pairError.message 
                        });
                    }
                    removeFile('./temp/' + id);
                }
            }

        } catch (err) {
            console.error("❌ Service Error:", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.status(500).send({ 
                    error: "Service is Currently Unavailable", 
                    details: err.message 
                });
            }
        }
    }

    await GIFTED_PAIR_CODE();
});

module.exports = router;
