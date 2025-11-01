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
   sock.loadAllMessages = (messageID) => {
      return Object.entries(sock.chats)
         .filter(([_, {
            messages
         }]) => typeof messages === "object")
         .find(([_, {
               messages
            }]) =>
            Object.entries(messages).find(
               ([k, v]) => k === messageID || v.key?.id === messageID,
            ),
         )?.[1].messages?.[messageID];
   };
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
   if (sock.user && sock.user.id) sock.user.jid = sock.decodeJid(sock.user.id);
   if (!sock.chats) sock.chats = {};

   function updateNameToDb(contacts) {
      if (!contacts) return;
      for (const contact of contacts) {
         const id = sock.decodeJid(contact.id);
         if (!id) continue;
         let chats = sock.chats[id];
         if (!chats) chats = sock.chats[id] = {
            id
         };
         sock.chats[id] = {
            ...chats,
            ...({
               ...contact,
               id,
               ...(id.endsWith("@g.us") ?
                  {
                     subject: contact.subject || chats.subject || ""
                  } :
                  {
                     name: contact.notify || chats.name || chats.notify || ""
                  }),
            } || {}),
         };
      }
   }

   sock.ev.on("contacts.upsert", updateNameToDb);
   sock.ev.on("groups.update", updateNameToDb);
   sock.ev.on("chats.set", async ({
      chats
   }) => {
      for (const {
            id,
            name,
            readOnly
         }
         of chats) {
         id = sock.decodeJid(id);
         if (!id) continue;
         const isGroup = id.endsWith("@g.us");
         let chats = sock.chats[id];
         if (!chats) chats = sock.chats[id] = {
            id
         };
         chats.isChats = !readOnly;
         if (name) chats[isGroup ? "subject" : "name"] = name;
         if (isGroup) {
            const metadata = await sock.groupMetadata(id).catch((_) => null);
            if (!metadata) continue;
            chats.subject = name || metadata.subject;
            chats.metadata = metadata;
         }
      }
   });
   sock.ev.on("group-participants.update", async function updateParticipantsToDb({
      id,
      participants,
      action
   }) {
      id = sock.decodeJid(id);
      if (!(id in sock.chats)) sock.chats[id] = {
         id
      };
      sock.chats[id].isChats = true;
      const groupMetadata = await sock.groupMetadata(id).catch((_) => null);
      if (!groupMetadata) return;
      sock.chats[id] = {
         ...sock.chats[id],
         subject: groupMetadata.subject,
         metadata: groupMetadata,
      };
   }, );
   sock.ev.on("groups.update", async function groupUpdatePushToDb(groupsUpdates) {
      for (const update of groupsUpdates) {
         const id = sock.decodeJid(update.id);
         if (!id) continue;
         const isGroup = id.endsWith("@g.us");
         if (!isGroup) continue;
         let chats = sock.chats[id];
         if (!chats) chats = sock.chats[id] = {
            id
         };
         chats.isChats = true;
         const metadata = await sock.groupMetadata(id).catch((_) => null);
         if (!metadata) continue;
         chats.subject = metadata.subject;
         chats.metadata = metadata;
      }
   }, );
   sock.ev.on("chats.upsert", async function chatsUpsertPushToDb(chatsUpsert) {
      const {
         id,
         name
      } = chatsUpsert;
      if (!id) return;
      let chats = (sock.chats[id] = {
         ...sock.chats[id],
         ...chatsUpsert,
         isChats: true,
      });
      const isGroup = id.endsWith("@g.us");
      if (isGroup) {
         const metadata = await sock.groupMetadata(id).catch((_) => null);
         if (metadata) {
            chats.subject = name || metadata.subject;
            chats.metadata = metadata;
         }
         const groups = (await sock.groupFetchAllParticipating().catch((_) => ({}))) || {};
         for (const group in groups)
            sock.chats[group] = {
               id: group,
               subject: groups[group].subject,
               isChats: true,
               metadata: groups[group],
            };
      }
   });
   sock.ev.on("presence.update", async function presenceUpdatePushToDb({ id, presences }) {
      const sender = Object.keys(presences)[0] || id;
      const _sender = sock.decodeJid(sender);
      const presence = presences[sender]["lastKnownPresence"] || "composing";
      let chats = sock.chats[_sender];
      if (!chats) chats = sock.chats[_sender] = {
         id: sender
      };
      chats.presences = presence;
      if (id.endsWith("@g.us")) {
         let chats = sock.chats[id];
         if (!chats) {
            const metadata = await sock.groupMetadata(id).catch((_) => null);
            if (metadata)
               chats = sock.chats[id] = {
                  id,
                  subject: metadata.subject,
                  metadata,
               };
         }
         chats.isChats = true;
      }
   }, );
   function getTimeFormatted() {
      return new Date().toLocaleTimeString("id-ID", {
         timeZone: process.env.Server,
         hour12: false
      });
   }
   sock.logger = {
      ...sock.logger,
      info(...args) {
         console.log(chalk.bold.rgb(57, 183, 16)(`✔ INFO [${chalk.white(getTimeFormatted())}]:`), chalk.cyan(...args));
      },
      error(...args) {
         console.log(chalk.bold.rgb(247, 38, 33)(`❌ ERROR [${chalk.white(getTimeFormatted())}]:`), chalk.rgb(255, 38, 0)(...args));
      },
      warn(...args) {
         console.log(
            chalk.bold.rgb(239, 225, 3)(`⚠️ WARNING [${chalk.white(getTimeFormatted())}]:`),
            chalk.bgYellow.black(" PERHATIAN! "),
            chalk.keyword("orange")(...args)
         );
      },
   };
   sock.appendTextMessage = async (m, text, chatUpdate) => {
      let messages = await generateWAMessage(
         m.chat, {
            text: text,
            mentions: m.mentionedJid,
         }, {
            userJid: sock.user.id,
            quoted: m.quoted && m.quoted.fakeObj,
         },
      );
      messages.key.fromMe = areJidsSameUser(m.sender, sock.user.id);
      messages.key.id = m.key.id;
      messages.pushName = m.pushName;
      if (m.isGroup) messages.participant = m.sender;
      let msg = {
         ...chatUpdate,
         messages: [proto.WebMessageInfo.fromObject(messages)],
         type: "append",
      };
      sock.ev.emit("messages.upsert", msg);
      return m;
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
   sock.saveMediaMessage = async (message, filePath, useExtension = true) => {
      let msgContent = message.msg ? message.msg : message;
      let mimeType = (message.msg || message).mimetype || '';
      let mediaType = mimeType.split('/')[0].replace("application", "document") || mimeType.split('/')[0];
      const stream = await downloadContentFromMessage(msgContent, mediaType);
      let mediaBuffer = Buffer.from([]);
      for await (const chunk of stream) {
         mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
      }
      let fileType = await FileType.fromBuffer(mediaBuffer);
      let finalPath = useExtension ? `${filePath}.${fileType.ext}` : filePath;
      await fs.writeFileSync(finalPath, mediaBuffer);
      return finalPath;
   };
   sock.sendReact = async (jid, text, quoted) => {
      let reactionMessage = {
         react: {
            text: text,
            key: quoted
         }
      };
      return await sock.sendMessage(jid, reactionMessage);
   };
   (sock.sendContact = async (jid, data, quoted, options) => {
      if (!Array.isArray(data[0]) && typeof data[0] === "string") data = [data];
      let contacts = [];
      for (let [number, name] of data) {
         number = number.replace(/[^0-9]/g, "");
         let njid = number + "@s.whatsapp.net";
         let biz = (await sock.getBusinessProfile(njid).catch((_) => null)) || {};
         let vcard = `BEGIN:VCARD
VERSION:3.0
FN:${name.replace(/\n/g, "\\n")}
ORG:
item1.TEL;waid=${number}:${PhoneNumber("+" + number).getNumber("international")}
item1.X-ABLabel:Ponsel${biz.description? `item2.EMAIL;type=INTERNET:${(biz.email || "").replace(/\n/g, "\\n")}
item2.X-ABLabel:Email
PHOTO;BASE64:${((await sock.getFile(await sock.profilePictureUrl(njid)).catch((_) => ({}))) || {}).number?.toString("base64")}
X-WA-BIZ-DESCRIPTION:${(biz.description || "").replace(/\n/g, "\\n")}
X-WA-BIZ-NAME:${name.replace(/\n/g, "\\n")}`: ""}
END:VCARD`.trim();
         contacts.push({
            vcard,
            displayName: name
         });
      }
      return sock.sendMessage(jid, {
         ...options,
         contacts: {
            ...options,
            displayName: (contacts.length >= 2 ? `${contacts.length} kontak` : contacts[0].displayName) || null,
            contacts
         }
      }, {
         quoted,
         ...options
      });
      enumerable: true;
   }),
   sock.reply = async (jid, text, quoted, options = {}) => {
      await sock.sendPresenceUpdate("composing", jid);
      const messageContent = {
         text,
         mentions: sock.parseMention(text),
         ai: !global.isGroups,
         ...options
      };
      return await sock.sendMessage(jid, messageContent, {
         quoted
      });
   };
   sock.resize = async (image, width, height) => {
      let oyy = await Jimp.read(image);
      let kiyomasa = await oyy.resize(width, height).Func.fetchBufferAsync(Jimp.MIME_JPEG);
      return kiyomasa;
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
   sock.sendGroupV4Invite = async (jid, participant, inviteCode, inviteExpiration, groupName = "unknown subject", caption = "Invitation to join my WhatsApp group", options = {}) => {
      let msg = proto.Message.fromObject({
         groupInviteMessage: proto.GroupInviteMessage.fromObject({
            inviteCode,
            inviteExpiration: parseInt(inviteExpiration) || +new Date(new Date() + 3 * 86400000),
            groupJid: jid,
            groupName: groupName ? groupName : this.getName(jid),
            caption,
         }),
      });
      let message = await this.prepareMessageFromContent(participant, msg, options);
      await this.relayWAMessage(message);
      return message;
   };
   sock.cMod = (jid, message, text = "", sender = sock.user.jid, options = {}) => {
      let copy = message.toJSON();
      let mtype = Object.keys(copy.message)[0];
      let isEphemeral = false;
      if (isEphemeral) {
         mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
      }
      let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
      let content = msg[mtype];
      if (typeof content === "string") msg[mtype] = text || content;
      else if (content.caption) content.caption = text || content.caption;
      else if (content.text) content.text = text || content.text;
      if (typeof content !== "string") msg[mtype] = {
         ...content,
         ...options
      };
      if (copy.participant) sender = copy.participant = sender || copy.participant;
      else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
      if (copy.key.remoteJid.includes("@s.whatsapp.net")) sender = sender || copy.key.remoteJid;
      else if (copy.key.remoteJid.includes("@broadcast")) sender = sender || copy.key.remoteJid;
      copy.key.remoteJid = jid;
      copy.key.fromMe = areJidsSameUser(sender, sock.user.id) || false;
      return proto.WebMessageInfo.fromObject(copy);
   };
   sock.copyNForward = async (jid, message, forwardingScore = true, options = {}) => {
      let m = generateForwardMessageContent(message, !!forwardingScore);
      let mtype = Object.keys(m)[0];
      if (forwardingScore && typeof forwardingScore == "number" && forwardingScore > 1)
         m[mtype].contextInfo.forwardingScore += forwardingScore;
      m = generateWAMessageFromContent(jid, m, {
         ...options,
         userJid: sock.user.id,
      });
      await sock.relayMessage(jid, m.message, {
         messageId: m.key.id,
         additionalAttributes: {
            ...options
         },
      });
      return m;
   };
   sock.loadMessage = sock.loadMessage || (async (messageID) => {
      return Object.entries(sock.chats).filter(([_, { messages }]) => typeof messages === "object").find(([_, { messages }]) => Object.entries(messages).find(([k, v]) => k === messageID || v.key?.id === messageID))?.[1].messages?.[messageID];
   }); 
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
   sock.sendSticker = async (jid, path, quoted, options = {}) => {
      let buffer;
      if (/^https?:\/\//.test(path)) {
         const response = await fetch(path);
         const arrayBuffer = await response.arrayBuffer();
         buffer = Buffer.from(arrayBuffer);
      } else if (Buffer.isBuffer(path)) {
         buffer = path;
      } else if (/^data:.*?\/.*?;base64,/i.test(path)) {
         buffer = Buffer.from(path.split(',')[1], 'base64');
      } else {
         buffer = Buffer.alloc(0);
      }

      let {
         mime
      } = await FileType.fileTypeFromBuffer(buffer);
      let convert;

      if (/image\/(jpe?g|png|gif)|octet/.test(mime)) {
         convert = (options && (options.packname || options.author)) ? await Exif.writeExifImg(buffer, options) : await Exif.imageToWebp(buffer);
      } else if (/video/.test(mime)) {
         convert = (options && (options.packname || options.author)) ? await Exif.writeExifVid(buffer, options) : await Exif.videoToWebp(buffer);
      } else if (/webp/.test(mime)) {
         convert = await Exif.writeExifWebp(buffer, options);
      } else {
         convert = Buffer.alloc(0);
      }

      await sock.sendPresenceUpdate('composing', jid);
      return sock.sendMessage(jid, {
         sticker: {
            url: convert
         },
         ...options
      }, {
         quoted
      });
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
   sock.getName = (jid = "", withoutContact = false) => {
      jid = sock.decodeJid(jid);
      withoutContact = this.withoutContact || withoutContact;
      let v;
      if (jid.endsWith("@g.us"))
         return new Promise(async (resolve) => {
            v = sock.chats[jid] || {};
            if (!(v.name || v.subject)) v = (await sock.groupMetadata(jid)) || {};
            resolve(v.name || v.subject || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international"));
         });
      else
         v = jid === "0@s.whatsapp.net" ? {
            jid,
            vname: "WhatsApp"
         } : areJidsSameUser(jid, sock.user.id) ? sock.user : sock.chats[jid] || {};
      return ((withoutContact ? "" : v.name) || v.subject || v.vname || v.notify || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international"));
   };
   sock.processMessageStubType = async (m) => {
      if (!m.messageStubType) return;
      const chat = sock.decodeJid(
         m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || "",
      );
      if (!chat || chat === "status@broadcast") return;
      const emitGroupUpdate = (update) => {
         sock.ev.emit("groups.update", [{
            id: chat,
            ...update
         }]);
      };
      switch (m.messageStubType) {
         case WAMessageStubType.REVOKE:
         case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
            emitGroupUpdate({
               revoke: m.messageStubParameters[0]
            });
            break;
         case WAMessageStubType.GROUP_CHANGE_ICON:
            emitGroupUpdate({
               icon: m.messageStubParameters[0]
            });
            break;
         default: {
            break;
         }
      }
      const isGroup = chat.endsWith("@g.us");
      if (!isGroup) return;
      let chats = sock.chats[chat];
      if (!chats) chats = sock.chats[chat] = {
         id: chat
      };
      chats.isChats = true;
      const metadata = await sock.groupMetadata(chat).catch((_) => null);
      if (!metadata) return;
      chats.subject = metadata.subject;
      chats.metadata = metadata;
   };
   sock.insertAllGroup = async () => {
      const groups =
         (await sock.groupFetchAllParticipating().catch((_) => null)) || {};
      for (const group in groups)
         sock.chats[group] = {
            ...(sock.chats[group] || {}),
            id: group,
            subject: groups[group].subject,
            isChats: true,
            metadata: groups[group],
         };
      return sock.chats;
   };
   sock.pushMessage = async (m) => {
      if (!m) return;
      if (!Array.isArray(m)) m = [m];
      for (const message of m) {
         try {
            if (!message) continue;
            if (message.messageStubType && message.messageStubType != WAMessageStubType.CIPHERTEXT)
               sock.processMessageStubType(message).catch(console.error);
            const _mtype = Object.keys(message.message || {});
            const mtype = (!["senderKeyDistributionMessage", "messageContextInfo"].includes(_mtype[0]) && _mtype[0]) || (_mtype.length >= 3 && _mtype[1] !== "messageContextInfo" && _mtype[1]) || _mtype[_mtype.length - 1];
            const chat = sock.decodeJid(message.key.remoteJid || message.message?.senderKeyDistributionMessage?.groupId || "");
            if (message.message?.[mtype]?.contextInfo?.quotedMessage) {
               let context = message.message[mtype].contextInfo;
               let participant = sock.decodeJid(context.participant);
               const remoteJid = sock.decodeJid(context.remoteJid || participant);
               let quoted = message.message[mtype].contextInfo.quotedMessage;
               if (remoteJid && remoteJid !== "status@broadcast" && quoted) {
                  let qMtype = Object.keys(quoted)[0];
                  if (qMtype == "conversation") {
                     quoted.extendedTextMessage = {
                        text: quoted[qMtype]
                     };
                     delete quoted.conversation;
                     qMtype = "extendedTextMessage";
                  }
                  if (!quoted[qMtype].contextInfo) quoted[qMtype].contextInfo = {};
                  quoted[qMtype].contextInfo.mentionedJid = context.mentionedJid || quoted[qMtype].contextInfo.mentionedJid || [];
                  const isGroup = remoteJid.endsWith("g.us");
                  if (isGroup && !participant) participant = remoteJid;
                  const qM = {
                     key: {
                        remoteJid,
                        fromMe: areJidsSameUser(sock.user.jid, remoteJid),
                        id: context.stanzaId,
                        participant,
                     },
                     message: JSON.parse(JSON.stringify(quoted)),
                     ...(isGroup ? {
                        participant
                     } : {}),
                  };
                  let qChats = sock.chats[participant];
                  if (!qChats) qChats = sock.chats[participant] = {
                     id: participant,
                     isChats: !isGroup,
                  };
                  if (!qChats.messages) qChats.messages = {};
                  if (!qChats.messages[context.stanzaId] && !qM.key.fromMe) qChats.messages[context.stanzaId] = qM;
                  let qChatsMessages;
                  if ((qChatsMessages = Object.entries(qChats.messages)).length > 40) qChats.messages = Object.fromEntries(qChatsMessages.slice(30, qChatsMessages.length));
               }
            }
            if (!chat || chat === "status@broadcast") continue;
            const isGroup = chat.endsWith("@g.us");
            let chats = sock.chats[chat];
            if (!chats) {
               if (isGroup) await sock.insertAllGroup().catch(console.error);
               chats = sock.chats[chat] = {
                  id: chat,
                  isChats: true,
                  ...(sock.chats[chat] || {}),
               };
            }
            let metadata, sender;
            if (isGroup) {
               if (!chats.subject || !chats.metadata) {
                  metadata = (await sock.groupMetadata(chat).catch((_) => ({}))) || {};
                  if (!chats.subject) chats.subject = metadata.subject || "";
                  if (!chats.metadata) chats.metadata = metadata;
               }
               sender = sock.decodeJid(
                  (message.key?.fromMe && sock.user.id) ||
                  message.participant ||
                  message.key?.participant ||
                  chat ||
                  "",
               );
               if (sender !== chat) {
                  let chats = sock.chats[sender];
                  if (!chats) chats = sock.chats[sender] = {
                     id: sender
                  };
                  if (!chats.name) chats.name = message.pushName || chats.name || "";
               }
            } else if (!chats.name) chats.name = message.pushName || chats.name || "";
            if (["senderKeyDistributionMessage", "messageContextInfo"].includes(mtype)) continue;
            chats.isChats = true;
            if (!chats.messages) chats.messages = {};
            const fromMe = message.key.fromMe || areJidsSameUser(sender || chat, sock.user.id);
            if (!["protocolMessage"].includes(mtype) && !fromMe && message.messageStubType != WAMessageStubType.CIPHERTEXT && message.message) {
               delete message.message.messageContextInfo;
               delete message.message.senderKeyDistributionMessage;
               chats.messages[message.key.id] = JSON.parse(
                  JSON.stringify(message, null, 2),
               );
               let chatsMessages;
               if ((chatsMessages = Object.entries(chats.messages)).length > 40)
                  chats.messages = Object.fromEntries(
                     chatsMessages.slice(30, chatsMessages.length),
                  );
            }
         } catch (e) {
            console.error(e);
         }
      }
   };
   sock.setBio = async (status) => {
      return await sock.query({
         tag: "iq",
         attrs: {
            to: "s.whatsapp.net",
            type: "set",
            xmlns: "status",
         },
         content: [{
            tag: "status",
            attrs: {},
            content: Buffer.from(status, "utf-8"),
         }],
      });
   };
   sock.serializeM = (m) => {
      return exports.smsg(sock, m)
   }
   return sock;
};

exports.smsg = (sock, m) => {
   if (!m) return m
   let M = proto.WebMessageInfo
   m = M.fromObject(m)

   if (m.key) {
      m.id = m.key.id
      m.chat = sock.decodeJid(m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || '')
      m.isGroup = m.chat.endsWith('@g.us')
      m.sender = sock.decodeJid((m.key.fromMe && sock.user.id) || m.participant || m.key.participant || m.chat || '')
      m.fromMe = m.key.fromMe || areJidsSameUser(m.sender, sock.user.id)
      m.isBaileys = m.id?.startsWith('3EB0') && m.id.length === 22
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
         m.mtype = keys.includes('senderKeyDistributionMessage')
            ? keys[keys.length - 1]
            : keys.find(k => k !== 'messageContextInfo') || keys[0]
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
         m.quoted.fakeObj = M.fromObject({
            key: {
               fromMe: m.quoted.fromMe,
               remoteJid: m.quoted.chat,
               id: m.quoted.id
            },
            message: quoted,
            ...(m.isGroup ? { participant: m.quoted.sender } : {})
         })

         m.quoted.reply = (text, opt = {}) => sock.reply(m.chat, text, m.quoted.fakeObj, opt)
         if (m.quoted.url || m.quoted.directPath) m.quoted.download = (saveToFile = false) => sock.downloadM(m.quoted, m.quoted.mtype.replace(/message/i, ""), saveToFile);
         m.quoted.copy = () => exports.smsg(sock, M.fromObject(M.toObject(m.quoted.fakeObj)))
         m.quoted.forward = (jid, force = false) => sock.forwardMessage(jid, m.quoted.fakeObj, force)
      }

      m.name = m.pushName || sock.getName(m.sender)
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

      m.react = async emoji =>
         sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })

      m.copy = () => exports.smsg(sock, M.fromObject(M.toObject(m)))
      m.forward = (jid = m.chat, fwd = false) => sock.copyNForward(jid, m, fwd)
      m.copyNForward = (jid = m.chat, fwd = true, opt = {}) => sock.copyNForward(jid, m, fwd, opt)
      m.cMod = (jid, text = '', sender = m.sender, opt = {}) => sock.cMod(jid, m, text, sender, opt)

      try {
         if (m.msg && m.mtype === 'protocolMessage') sock.ev.emit('message.delete', m.msg.key)
      } catch (e) {
         console.error(e)
      }
   }

   return m
}
