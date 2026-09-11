FIX 09/09/2026 - Manual IKU Sasaran Strategis

Perubahan:
1. Field Sasaran Strategis tidak lagi menggunakan HTML datalist karena datalist tidak menjamin dropdown terbuka saat user klik field.
2. Diganti menjadi custom combobox.
3. Tombol panah membuka daftar seluruh data dari planning.strategic_objective yang dikirim endpoint /api/master/strategic-objectives.
4. Saat mengetik, daftar otomatis difilter berdasarkan nama/kode.
5. Data master dapat dipilih; strategic_objective_id dan strategic_objective_name disimpan.
6. Jika data belum ada, akan muncul opsi "Gunakan sasaran manual: ...". Saat dipilih, strategic_objective_id dikosongkan dan strategic_objective_name menyimpan teks manual.
7. Tidak membutuhkan migration tambahan.

Catatan build:
Project ZIP tidak menyertakan node_modules. Jalankan npm ci/npm install pada FE sebelum build/deploy.
