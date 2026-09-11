# SIMONIK Database — Clean Migration Set

Karena database lama sudah dihapus, baseline lama (001–013) diringkas menjadi **3 file utama**:

1. `DB/001_initial_schema.sql` — seluruh schema, tabel, FK, index, trigger, dan struktur final.
2. `DB/002_views.sql` — view turunan.
3. `DB/003_seed.sql` — master/demo data, struktur UKE, role, akun demo, kategori risiko, dan risk level default.

`DB/004_future_migrations_template.sql` hanya template untuk perubahan berikutnya.

## Urutan instalasi

Jalankan pada database PostgreSQL yang benar-benar kosong:

```bash
psql -U <user> -d <database> -f DB/001_initial_schema.sql
psql -U <user> -d <database> -f DB/002_views.sql
psql -U <user> -d <database> -f DB/003_seed.sql
```

Tidak perlu menjalankan migration 001–013 lama lagi.

## Desain Sasaran Strategis

`planning.strategic_objective` sekarang menjadi master canonical.

`performance.iku_manual.strategic_objective_id` langsung menjadi FK ke master tersebut.

`strategic_objective_name` tetap tersedia hanya sebagai snapshot/kompatibilitas.

Alur:

Planning `strategic_objective`
→ Performance `iku_manual`
→ Performance Agreement / Output
→ Risk.

## Catatan

Default risk bands masih mengikuti nilai aplikasi sebelumnya dan diberi catatan untuk validasi terhadap matriks resmi yang digunakan organisasi.

Akun demo menggunakan password `simonik123`.


### Status field performance
- `performance.iku_manual.manual_iku_status` untuk workflow Manual IKU.
- `performance.performance_agreement.perjanjian_kinerja_status` untuk workflow Perjanjian Kinerja.
