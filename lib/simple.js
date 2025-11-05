/*
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                 🌟 CREDITS & NOTES 🌟                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

[ 🙏 SPECIAL THANKS TO THE MASTERS ]
- LORENZO (For continuous support and ideas)
- Sansekai (Big thanks for the original INDEX.JS structure! I learned and recoded a lot from it.)
- All contributors and open-source communities who helped shape this project.

[ 📢 IMPORTANT NOTES & LICENSE ]
=================================================

THIS BOT IS FREE TO USE AND MODIFY.
DO NOT SELL THIS CODE OR CLAIM IT AS 100% YOUR OWN ORIGINAL WORK.
RESPECT THE ORIGINAL DEVELOPERS.

!!! WARNING !!!
If you violate this rule by selling this free code, remember:
GOD IS ALWAYS WATCHING.

=================================================
*/

const {
   default: makeWASocket,
   makeWALegacySocket,
   extractMessageContent,
   makeInMemoryStore,
   proto,
   prepareWAMessageMedia,
   downloadContentFromMessage,
   getBinaryNodeChild,
   jidDecode,
   generateWAMessage,
   areJidsSameUser,
   generateForwardMessageContent,
   generateWAMessageFromContent,
   WAMessageStubType,
   WA_DEFAULT_EPHEMERAL,
   getContentType,
   jidNormalizedUser,
} = require("baileys");
const {
   execSync
} = require('child_process');
const axios = require('axios');
const chalk = require("chalk");
const fetch = require("node-fetch");
const FileType = require("file-type");
const PhoneNumber = require("awesome-phonenumber");
const fs = require("fs");
const path = require("path");
let Jimp = require("jimp");
const pino = require("pino");
const { Component } = require('@neoxr/wb')
const { Function: Func, NeoxrApi } = new Component

const {
   toAudio,
   toPTT,
   toVideo
} = require('./converter')
const Exif = new(require('./exif'))

const ephemeral = {
   ephemeralExpiration: 8600
};

exports.makeWASocket = (...args) => {
   let sock = makeWASocket(...args)
   Object.defineProperty(sock, "name", {
      value: "WASocket",
      configurable: true,
   });

   sock.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
         const decode = jidDecode(jid) || {};
         return (
            (decode.user && decode.server && decode.user + "@" + decode.server) ||
            jid
         );
      } else return jid;
   };

   sock.getFile = async (PATH, returnAsFilename) => {
      let res, filename;
      const data = Buffer.isBuffer(PATH) ?
         PATH :
         /^data:.*?\/.*?;base64,/i.test(PATH) ?
         Buffer.from(PATH.split`,` [1], "base64") :
         /^https?:\/\//.test(PATH) ?
         await (res = await fetch(PATH)).buffer() :
         fs.existsSync(PATH) ?
         ((filename = PATH), fs.readFileSync(PATH)) :
         typeof PATH === "string" ?
         PATH :
         Buffer.alloc(0);
      if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");
      const type = (await FileType.fromBuffer(data)) || {
         mime: "application/octet-stream",
         ext: ".bin",
      };
      if (data && returnAsFilename && !filename)
         (filename = path.join(process.cwd(), "/temp/" + new Date() * 1 + "." + type.ext)),
         await fs.promises.writeFile(filename, data);
      return {
         res,
         filename,
         ...type,
         data,
         deleteFile() {
            return filename && fs.promises.unlink(filename);
         },
      };
   };
   
   sock.sendFile = async (jid, file, filename, caption = "", quoted, options = {}) => {
    try {
    let type = await Func.getFile(file);
    console.log(type)
    if (!type.status) throw new Error("Gagal mendapatkan file");
    let { file: filePath, mime, extension } = type;
    let mtype;
    if (mime.includes("audio")) {
      let converted = await toAudio(fs.readFileSync(filePath), extension);
      if (!converted.data) throw new Error("Gagal mengonversi ke MP3");
      filePath = converted.filename;
      mime = "audio/mpeg"; 
      mtype = "audio";
    } else if (mime.includes("video")) {
      let converted = await toVideo(fs.readFileSync(filePath), extension);
      if (!converted.data) throw new Error("Gagal mengonversi ke MP4");
      filePath = converted.filename;
      mime = "video/mp4";
      mtype = "video";
      if (options?.gif) options.gifPlayback = true;
    } else if (mime.includes("image")) {
      mtype = "image"; 
    } else {
      mtype = "document"; 
    }

    let message = {
      [mtype]: fs.readFileSync(filePath), 
      mimetype: mime,
      fileName: filename || path.basename(filePath),
      caption,
      ptt: !!options.ptt, 
      ...options,
    };

    if (quoted) message.quoted = quoted;

     let result = await sock.sendMessage(jid, message, options);
      if (filePath !== type.file && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      }
      return result;
    } catch (error) {
     console.log(error);
    }
   };
   
   sock.downloadM = async (m, type, saveToFile) => {
      if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
      const stream = await downloadContentFromMessage(m, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
         buffer = Buffer.concat([buffer, chunk]);
      }
      if (saveToFile) var {
         filename
      } = await sock.getFile(buffer, true);
      return saveToFile && fs.existsSync(filename) ? filename : buffer;
   };
   
   sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
      let quoted = message.msg ? message.msg : message;
      let mime = (message.msg || message).mimetype || "";
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
      const stream = await downloadContentFromMessage(quoted, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
         buffer = Buffer.concat([buffer, chunk]);
      }
      let type = await FileType.fileTypeFromBuffer(buffer);
      trueFileName = attachExtension ? filename + "." + type.ext : filename;
      await fs.writeFileSync(trueFileName, buffer);
      return trueFileName;
   };
   
   sock.parseMention = (text = "") => {
      return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map((v) => v[1] + "@s.whatsapp.net");
   };
   sock.downloadMediaMessage = async (message) => {
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message|WithCaption/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(message, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
         buffer = Buffer.concat([buffer, chunk])
      }
      return buffer
   }

   sock.serializeM = (m) => {
      return exports.smsg(sock, m)
   }
   return sock;
};

exports.smsg = (sock, m) => {
   if (!m) return m
   const { messages } = m;
   m = messages[0];
	
   if (m.key) {
      m.id = m.key.id
      m.isGroup = m.key.remoteJid.endsWith("@g.us")
      m.chat = jidNormalizedUser(m.key.remoteJid);
      m.sender = jidNormalizedUser(m.isGroup ? m.key.participantAlt || m.key.participant || sock.user.id : m.key.remoteJidAlt || m.key.remoteJid || sock.user.id)
      m.fromMe = m.key.fromMe || areJidsSameUser(m.sender, sock.user.id)
   }

   if (m.message) {
      if (m.message.viewOnceMessage) {
         m.mtype = Object.keys(m.message.viewOnceMessage.message)[0]
         m.msg = m.message.viewOnceMessage.message[m.mtype]
      } else if (m.message.viewOnceMessageV2) {
         m.mtype = Object.keys(m.message.viewOnceMessageV2.message)[0]
         m.msg = m.message.viewOnceMessageV2.message[m.mtype]
      } else {
         let keys = Object.keys(m.message)
         m.mtype = keys.includes('senderKeyDistributionMessage') ? keys[keys.length - 1] : keys.find(k => k !== 'messageContextInfo') || keys[0]
         m.msg = m.message[m.mtype]
      }

      if (['ephemeralMessage', 'documentWithCaptionMessage'].includes(m.mtype)) {
         exports.smsg(sock, m.msg)
         m.mtype = m.msg.mtype
         m.msg = m.msg.msg
      }

      m.text =
         (m.mtype === 'interactiveResponseMessage'
            ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id
            : m.mtype === 'conversation'
            ? m.message.conversation
            : m.mtype === 'imageMessage'
            ? m.message.imageMessage.caption
            : m.mtype === 'videoMessage'
            ? m.message.videoMessage.caption
            : m.mtype === 'extendedTextMessage'
            ? m.message.extendedTextMessage.text
            : m.mtype === 'buttonsResponseMessage'
            ? m.message.buttonsResponseMessage.selectedButtonId
            : m.mtype === 'listResponseMessage'
            ? m.message.listResponseMessage.singleSelectReply.selectedRowId
            : m.mtype === 'templateButtonReplyMessage'
            ? m.message.templateButtonReplyMessage.selectedId
            : '') || ''

      const context = m.msg?.contextInfo || {}
      let quoted = (m.quoted = context.quotedMessage ? context.quotedMessage : null)
      m.mentionedJid = context.mentionedJid || []

      if (quoted) {
         let type = Object.keys(quoted)[0]
         m.quoted = quoted[type]
         if (['productMessage', 'documentWithCaptionMessage'].includes(type)) {
            let key2 = Object.keys(m.quoted.message || m.quoted)[0]
            m.quoted = m.quoted.message ? m.quoted.message[key2] : m.quoted[key2]
         }

         if (typeof m.quoted === 'string') m.quoted = { text: m.quoted }

         m.quoted.mtype = type
         m.quoted.id = context.stanzaId
         m.quoted.chat = sock.decodeJid(context.remoteJid || m.chat)
         m.quoted.sender = sock.decodeJid(context.participant)
         m.quoted.fromMe = m.quoted.sender === sock.user.id
         m.quoted.text =
            m.quoted.text ||
            m.quoted.caption ||
            m.quoted.contentText ||
            m.quoted.conversation ||
            ''
         m.quoted.mentionedJid = m.quoted.contextInfo?.mentionedJid || []
         if (m.quoted.url || m.quoted.directPath) m.quoted.download = (saveToFile = false) => sock.downloadM(m.quoted, m.quoted.mtype.replace(/message/i, ""), saveToFile);
      }

      if (m.msg?.url) m.download = (save = false) => sock.downloadM(m.msg, m.mtype.replace(/message/i, ''), save)

      m.reply = async (text, opt = {}) =>
         sock.sendMessage(
            m.chat,
            {
               text,
               mentions: sock.parseMention(text),
               ...opt
            },
            { quoted: m, ephemeralExpiration: m.expiration }
         )
   }

   return m
}