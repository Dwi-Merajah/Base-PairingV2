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
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  jidDecode
} = require("baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");
const chalk = require("chalk");
const fs = require("fs");
const { features } = require("./case")
const logger = P({ level: "silent" });
let simple = require("./lib/simple");
const chokidar = require('chokidar');
const path = require('path');
const Table = require('cli-table3');
const os = require('os');
const env = require("./config.json")

async function connectToWhatsApp() {
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(`./session`);
  const {
    version
  } = await fetchLatestBaileysVersion();

  const connectionOptions = {
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: !env.system.pairing,
    retryRequestDelayMs: 300,
    maxMsgRetryCount: 10,
    version,
    logger,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    browser: Browsers.macOS("Chrome"),
  };

  global.sock = simple.makeWASocket(connectionOptions)
  async function validatePhoneNumber(input) {
      if (!input) return null;
      let phoneNumber = String(input).replace(/[^0-9]/g, "");
      let pn = phoneNumber.startsWith("+") ? new PhoneNumber(phoneNumber) : new PhoneNumber(`+${phoneNumber}`);
      if (!pn.isValid() || !pn.isMobile()) {
         console.log(chalk.redBright("❌ Invalid phone number. Please enter a valid WhatsApp number (e.g., 62xxx)."));
         return null;
      }
      return pn.getNumber("e164").replace("+", "");
  };
   
  if (env.system.pairing && !sock.authState.creds.registered) {
    const phoneNumber = await validatePhoneNumber(env.system.number);
    setTimeout(async () => {
      let code = await sock.requestPairingCode(phoneNumber)
      code = code?.match(/.{1,4}/g)?.join('-') || code
      console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
      }, 2000);
  }

  sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const {
        connection,
        lastDisconnect
      } = update;
      const status = lastDisconnect?.error?.output?.statusCode;

      if (connection === "close") {
        const reason = Object.entries(DisconnectReason).find((i) => i[1] === status)?.[0] || "unknown";

        switch (reason) {
          case "multideviceMismatch":
          case "loggedOut":
            console.error(lastDisconnect?.error);
            fs.rmSync(`./session`, {
              recursive: true,
              force: true
            });
            console.log(chalk.yellow("🗑️ Session dihapus. Jalankan ulang untuk login ulang."));
            break;

          default:
            if (status === 403) {
              console.error(lastDisconnect?.error);
              fs.rmSync(`./session`, {
                recursive: true,
                force: true
              });
            } else {
              console.log(chalk.blue("🔁 Mencoba menyambung ulang..."));
              connectToWhatsApp();
            }
        }
      } else if (connection === "open") {
        const formatBytes = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        const processMemory = process.memoryUsage();
        const cpuCount = os.cpus().length;
        const platform = os.platform();
        const totalMem = formatBytes(os.totalmem());
        const freeMem = formatBytes(os.freemem());
        const usedMemPercent = ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%';
        const table = new Table({
          colWidths: [18, 40],
          wordWrap: true,
          style: {
            head: [],
            border: ['cyan']
          }
        });
        table.push(
          [{
            colSpan: 2,
            content: chalk.bold.underline.yellow('🚀 BOT STARTUP INFO'),
            hAlign: 'center'
          }],
          [chalk.cyan('STATUS'), chalk.green(`✅ Connected as: ${jidDecode(sock?.user?.id)?.user || "Unknown"}`)],
          [chalk.cyan('PLATFORM'), chalk.white(`${platform} (${os.release()})`)],
          [chalk.cyan('NODE.JS VERSION'), chalk.white(process.version)],
          [chalk.cyan('CPU CORES'), chalk.white(cpuCount)],
          [chalk.cyan('RAM SYSTEM (USED %)'), chalk.white(`${totalMem} Total | ${freeMem} Free (${usedMemPercent} Used)`)],
        );
        console.log(table.toString());
      }
    }

    if (ev["creds.update"]) {
      await saveCreds();
    }

    const upsert = ev["messages.upsert"];
    if (upsert) {
      if (upsert.type === "notify") {
        const msg = upsert.messages?.[0];
        if (msg) {
          const message = simple.smsg(sock, msg);
          if (message) {
            if (message.key?.remoteJid !== "status@broadcast" && !message.key.fromMe) {
              features(upsert, sock, message);
            }
          }
        }
      }
    }

    if (ev["call"]) {
      const call = ev["call"];
      let {
        id,
        chatId,
        isGroup
      } = call[0];
      if (isGroup) return;
      await sock.rejectCall(id, chatId);
      await sock.sendMessage(chatId, {
        text: "📵 Maaf, bot tidak bisa menerima panggilan suara/video.",
      });
    }
  });
}

connectToWhatsApp();