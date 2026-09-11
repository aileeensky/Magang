'use client';
import { Card, PageTitle } from '../../ui';

export default function Placeholder({title,text}:{title:string;text:string}){return <section><PageTitle icon="bi-hourglass-split" title={title} subtitle={text}/><Card title="Tahap Pengembangan"><div className="empty-state"><i className="bi bi-boxes"/><b>Fondasi modul siap dikembangkan.</b><span>{text}</span></div></Card></section>}
