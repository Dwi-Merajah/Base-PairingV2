
## 🤖 Dwi-Base - WhatsApp Bot
Dwi-Base adalah kerangka dasar (base) bot WhatsApp modern yang dibangun menggunakan library Baileys (WhiskeySockets). Base ini dirancang dengan struktur modular yang rapi, memisahkan logika koneksi (index.js) dari logika perintah (case.js), membuatnya sangat mudah untuk dikembangkan dan dikustomisasi.
✨ Fitur Unggulan
 * Login Pairing Code: Opsi login utama menggunakan Pairing Code via nomor telepon, tanpa perlu scan QR Code di terminal (diatur di config.json).
 * Struktur Modular: Logika bot terbagi jelas antara Core Connection (index.js) dan Feature Handling (case.js).
 * Console Log Interaktif: Pesan masuk dan perintah dicatat ke konsol menggunakan cli-table3 dengan tampilan yang rapi dan informatif (menampilkan User Status dan Chat Group).
 * Owner Commands (Eval & Shell): Fitur eksekusi kode JavaScript (>, =>) dan perintah shell ($) yang aman, hanya dapat diakses oleh Owner.
 * Startup Info Detail: Menampilkan informasi sistem yang komprehensif saat bot terhubung (OS, CPU, RAM, Node.js Version).
 * Auto-Reconnect & Session Management: Otomatis menyambung ulang saat koneksi terputus dan menghapus sesi jika logged out.
 * Auto Call Blocker: Secara otomatis menolak panggilan suara/video.

---

## 📁 Struktur Proyek
| File | Kategori | Deskripsi Utama |
|---|---|---|
| index.js | Core | Menangani koneksi ke WhatsApp, event handler (koneksi, creds update, call), dan print info startup. |
| case.js | Features | Semua logika perintah bot berada di sini. Bertanggung jawab atas deteksi prefix, switch case commands, dan log console pesan masuk. |
| config.json | Config | Pengaturan fungsional seperti limit, time zone, dan konfigurasi login system (pairing/QR). |
| package.json | System | Metadata proyek, script start, dan daftar 30+ dependencies utama yang digunakan. |
| lib/simple.js | Utils | (Diasumsikan) Berisi fungsi-fungsi pembantu untuk menyederhanakan objek pesan Baileys menjadi format m. |

---

## ⚙️ Dependencies Utama
Proyek ini mengandalkan beberapa paket Node.js yang kuat:
 * baileys & @neoxr/wb: Library inti WhatsApp dan utilitas tambahan.
 * pino & chalk: Digunakan untuk logging yang rapi dan berwarna di konsol.
 * cli-table3: Membuat tampilan tabel yang elegan untuk log pesan dan info startup.
 * chokidar: Untuk auto-reload file saat ada perubahan (Hot Reload).
 * axios, node-fetch: Untuk permintaan HTTP (seperti command #get).
 * jimp, sharp, node-webpmux: Untuk manipulasi gambar, stiker, dan media.
---
## 🚀 Instalasi dan Menjalankan Bot
1. Kloning Repositori
```javascript
git clone https://github.com/Dwi-Merajah/Base-PairingV2
cd Base-PairingV2
npm install
npm start
```
3. Konfigurasi Owner & Login
Edit file config.json untuk mengatur owner dan metode login:
```json
{
  "limit": "15",
  "reset": "true",
  "owner": ["6285133663664"], // Tambahkan nomor owner
  "time": "Asia/Makassar",
  "system": {
    "pairing": true, // SET KE true UNTUK PAIRING CODE, false UNTUK QR CODE
    "number": "6282227419393" // NOMOR WA UNTUK PAIRING (Tanpa +)
  }
}
```
4. Jalankan Bot
npm start

5. Proses Login
 * Jika system.pairing: true, bot akan mencetak Pairing Code di terminal.
 * Buka WhatsApp di HP Anda: Pengaturan > Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon.
 * Masukkan Pairing Code yang muncul di terminal.
 * Jika system.pairing: false, bot akan mencetak QR Code untuk Anda scan.
---

## 🛠️ Daftar Perintah
Prefix yang didukung secara default adalah: #!.,®©¥€¢£/\∆✓.
| Kategori | Perintah | Deskripsi | Hak Akses |
|---|---|---|---|
| Main | #menu | Menampilkan daftar perintah ini. | All Users |
|  | #ping, #tes, #halo | Tes fungsionalitas dan status bot. | All Users |
|  | #get <url> | Mengunduh file dari URL atau menampilkan konten teks/JSON. | All Users |
| Owner | > <kode> | Mengevaluasi kode JavaScript secara async. | Owner Only |
|  | => <kode> | Mengevaluasi kode JavaScript biasa. | Owner Only |
|  | $ <perintah> | Mengeksekusi perintah shell di server. | Owner Only |

---
## 📜 Credits & License
THIS BOT IS FREE TO USE AND MODIFY.
🙏 Special Thanks To:
 * LORENZO (For continuous support and ideas)
 * Sansekai (For the original INDEX.JS structure that served as a learning foundation).
 * All open-source communities and contributors.
 
DO NOT SELL THIS CODE atau klaim 100% sebagai pekerjaan asli Anda. Hormati para pengembang aslinya.
---
