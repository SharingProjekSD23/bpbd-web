"use client";

import { useState } from 'react';
import { ChevronDown, FolderOpen, HardHat, ShieldCheck, Waves } from 'lucide-react';
import { areas, groups, number } from '@/lib/bpbd/model';
import { Notice, PageHead } from './shared';
import styles from './research-catalog.module.css';

// Keep this public preview independent of operational records and access grants.
const categories = Object.entries(groups)
  .filter(([, group]) => group.role !== 'SEK')
  .map(([code, group]) => ({
    ...group,
    code,
    datasets: Array.from({ length: 5 }, (_, index) => ({
      id: `contoh-${code}-${index + 1}`,
      title: `${group.examples[index % group.examples.length]} (contoh ${index + 1})`,
      rows: areas.map((area, areaIndex) => ({
        area,
        date: `2026-${String(index + 1).padStart(2, '0')}-${String(areaIndex + 1).padStart(2, '0')}`,
        amount: group.unit === '%' ? 20 + (areaIndex + index) % 9 * 10 : (areaIndex + 1) * (index + 1) * 5,
      })),
    })),
  }));

const dateFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
const fullDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00+07:00`));

export function ShowResearchData() {
  const [openCategory, setOpenCategory] = useState<string | null>(categories[0].code);
  const [selectedId, setSelectedId] = useState(categories[0].datasets[0].id);
  const category = categories.find(item => item.datasets.some(dataset => dataset.id === selectedId))!;
  const dataset = category.datasets.find(item => item.id === selectedId)!;
  const preview = dataset.rows.slice(0, 5);

  return <>
    <PageHead title="Data" subtitle="Pilih kategori dan dataset untuk melihat contoh data per kecamatan sebelum mengajukan permohonan." />
    <Notice>Pratinjau dan jumlah baris di halaman ini menggunakan data contoh sintetis. Data sebenarnya tersedia setelah permohonan disetujui dan izin akses diaktifkan.</Notice>
    <div className={styles.layout}>
      <nav className={styles.navigation} aria-label="Kategori dan dataset penelitian">
        <div className={styles.navHeading}>
          <h2>Kategori data</h2>
          <p>{categories.length} kategori tersedia</p>
        </div>
        <div className={styles.categories}>
          {categories.map(item => {
            const expanded = openCategory === item.code;
            const Icon = item.role === 'KL' ? Waves : item.role === 'PK' ? ShieldCheck : HardHat;
            return <section className={styles.category} key={item.code}>
              <h3>
                <button
                  type="button"
                  className={styles.categoryButton}
                  aria-expanded={expanded}
                  aria-controls={`catalog-${item.code}`}
                  onClick={() => setOpenCategory(expanded ? null : item.code)}
                >
                  <span className={styles.categoryIcon} data-field={item.role}><Icon size={18} aria-hidden="true" /></span>
                  <span>{item.name}</span>
                  <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
                </button>
              </h3>
              <ul id={`catalog-${item.code}`} className={styles.datasets} hidden={!expanded}>
                {item.datasets.map(option => <li key={option.id}>
                  <button
                    type="button"
                    className={styles.datasetButton}
                    aria-current={selectedId === option.id ? 'true' : undefined}
                    aria-controls="research-catalog-preview"
                    onClick={() => setSelectedId(option.id)}
                  >{option.title}</button>
                </li>)}
              </ul>
            </section>;
          })}
        </div>
      </nav>
      <section id="research-catalog-preview" className={`panel ${styles.preview}`} aria-labelledby="catalog-title">
        <div className={styles.previewHeading}>
          <div className={styles.categoryLabel}><FolderOpen size={16} aria-hidden="true" />{category.name}</div>
          <h2 id="catalog-title">{dataset.title}</h2>
          <p>Rincian per kecamatan di Kota Semarang</p>
          <p>Periode data: {fullDate(dataset.rows[0].date)} – {fullDate(dataset.rows.at(-1)!.date)}</p>
          <span className={styles.sampleBadge}>Data contoh</span>
        </div>
        <div className={styles.tableScroll} role="region" aria-label="Tabel contoh per kecamatan" tabIndex={0}>
          <table className={styles.table} aria-labelledby="catalog-title">
            <thead>
              <tr>
                <th scope="col">Kecamatan</th>
                <th scope="col">Tanggal data</th>
                <th scope="col">{category.metric}<span>({category.unit})</span></th>
              </tr>
            </thead>
            <tbody>
              {preview.map(row => <tr key={row.area}>
                <th scope="row">{row.area}</th>
                <td><time dateTime={row.date}>{fullDate(row.date)}</time></td>
                <td>{number(row.amount)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter} role="status">
          <span>Menampilkan <strong>{preview.length}</strong> dari <strong>{number(dataset.rows.length)}</strong> baris contoh yang tersedia.</span>
          <span>Pratinjau maksimal 5 baris</span>
        </div>
      </section>
    </div>
  </>;
}
