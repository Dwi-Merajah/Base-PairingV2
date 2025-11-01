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
  generateWAMessageFromContent,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  prepareWAMessageMedia,
} = require('baileys');
const axios = require('axios');
const fs = require("fs");
const util = require("util");
const chalk = require('chalk');
const { format } = require('util');
const { exec } = require('child_process');
const fetch = require("node-fetch");
const { Component } = require('@neoxr/wb');
const { Function: Func, NeoxrApi } = new Component();
const syntax = require('syntax-error');
const env = require("./config.json")
/**
 * Fitur utama Case command
 * @param {*} mess - pesan mentah
 * @param {*} sock - instance baileys
 * @param {*} m - pesan yang sudah diserialisasi
 */
const features = async (mess, sock, m) => {
  try {
    const body = m.text
    if (!body) return;

    // Deteksi prefix
    const prefix = /^[#!.,®©¥€¢£/\∆✓]/.test(body) ? body[0] : '#';
    const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const text = args.join(' ');

    const isOwner = env.owner.map(v => v + '@s.whatsapp.net').includes(m.sender);

    // Ambil metadata grup
    const getGroupMetadata = async () => {
      if (!m.isGroup) return {};
      const groupMetadata = await sock.groupMetadata(m.chat);
      const participants = groupMetadata.participants;
      const adminList = participants.filter(v => v.admin !== null).map(v => v.id);
      const isAdmin = adminList.includes(m.sender);
      const isBotAdmin = adminList.includes((sock.user.id.split`:`[0]) + '@s.whatsapp.net');
      return { groupMetadata, isAdmin, isBotAdmin };
    };

    const groupMetadata = await getGroupMetadata();
    const isAdmin = groupMetadata.isAdmin;
    const isBotAdmin = groupMetadata.isBotAdmin;

    // Logs Console 
    await sock.readMessages([m.key]);
    const Table = require('cli-table3');
    const isCommand = body.startsWith(prefix);
    const type = isCommand ? chalk.green('CMD') : chalk.yellow('MSG');
    const from = `${chalk.magenta(m.pushName || 'Unknown')}`;
    const chat = m.isGroup ? chalk.blue(groupMetadata.groupMetadata?.subject) : chalk.cyan('Private Chat');
    const message = chalk.white(body.length > 60 ? m.mtype : m.mtype);
    const status = isOwner ? "Owner" : "Users"
    const table = new Table({
      colWidths: [12, 30], 
      wordWrap: true,
      style: {
        head: [],
        border: ['grey']
      }
    });

    table.push(
      [chalk.cyan('TYPE'), type],
      [chalk.cyan('FROM'), from],
      [chalk.cyan('CHAT'), chat],
      [chalk.cyan('STATUS'), status],
      [chalk.cyan('MESSAGE'), message]
    );

    console.log(table.toString());

    if (body.startsWith('=>')) {
      if (!isOwner)
        return sock.sendMessage(m.chat, { text: "❌ Hanya owner yang bisa eval kode JS!" }, { quoted: m });
      try {
        const evL = await eval(`(async () => { return ${text} })()`);
        sock.reply(m.chat, Func.jsonFormat(evL), m);
      } catch (e) {
        const err = await syntax(text);
        m.reply((typeof err != 'undefined' ? Func.texted('monospace', err) + '\n\n' : '') + require('util').format(e));
      }
      return;
    }

    if (body.startsWith('>')) {
      if (!isOwner)
        return sock.sendMessage(m.chat, { text: "❌ Hanya owner yang bisa eval async!" }, { quoted: m });
      try {
        const evL = await eval(`(async () => { ${text} })()`);
        m.reply(Func.jsonFormat(evL));
      } catch (e) {
        const err = await syntax(text);
        m.reply((typeof err != 'undefined' ? Func.texted('monospace', err) + '\n\n' : '') + Func.jsonFormat(e));
      }
      return;
    }

    if (body.startsWith('$')) {
      if (!isOwner)
        return sock.sendMessage(m.chat, { text: "❌ Hanya owner yang bisa eksekusi shell!" }, { quoted: m });
      exec(text.trim(), (err, stdout) => {
        if (err) return m.reply(err.toString());
        if (stdout) return m.reply(stdout.toString());
      });
      return;
    }

    if (!body.startsWith(prefix)) return;
    switch (command) {
      case 'ping':
      case 'tes':
      case 'halo': {
        await sock.sendMessage(m.chat, { text: `Bot aktif dengan perintah: ${command}` }, { quoted: m });
        break;
      }

      case 'get': {
        if (!args[0])
          return sock.sendMessage(m.chat, { text: 'Masukkan URL yang valid!' }, { quoted: m });
        await m.reply("Please Wait A Minute");
        try {
          const { href: url, origin } = new URL(args[0]);
          const res = await fetch(url, { headers: { referer: origin } });
          const size = res.headers.get('content-length');
          const type = res.headers.get('content-type');
          if (size > 100 * 1024 * 1024)
            throw `File terlalu besar! (${size})`;
          const result = await Func.getFile(args[0]);
          if (!/text|json/.test(type))
            return sock.sendFile(m.chat, process.cwd() + "/" + result.file, Func.filename(result.extension), args[0], m);
          let txt = await res.buffer();
          try {
            txt = format(JSON.parse(txt + ''));
          } catch {
            txt = txt + '';
          }
          sock.sendMessage(m.chat, { text: txt.trim().slice(0, 65536) }, { quoted: m });
        } catch (err) {
          sock.sendMessage(m.chat, { text: util.format(err) }, { quoted: m });
        }
        break;
      }

      case 'menu': {
        const menu = `
*📜 Daftar Perintah:*

╭───「 📜 Main 」───
│ • ${prefix}ping
│ • ${prefix}get <url/link>
╰───────────────
╭───「 🔒 Owner 」───
│ • > <text/code>
│ • => <text/code>
│ • $ <text/code>
╰───────────────`;
        await sock.sendMessage(m.chat, { text: menu }, { quoted: m });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(chalk.red('[ERROR]'), err);
  }
};

module.exports = { features };

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`File ${__filename} Has Been Update`));
  delete require.cache[file];
  require(file);
});
