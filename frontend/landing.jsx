import React from 'react';
import { Avatar } from './avatar-picker.jsx';
import { Icon } from './design-system.jsx';

const preview = [
  { tone: 'mint', title: 'خوب پیش رفت', notes: ['بازبینی کد دونفره', 'انتشار بدون استرس'], votes: '۴' },
  { tone: 'peach', title: 'دشوار بود', notes: ['انتظار برای تأیید تغییرات', 'ابهام در اولویت‌ها'], votes: '۳' },
  { tone: 'iris', title: 'امتحان کنیم', notes: ['چک‌لیست قبل از انتشار', 'مرور کوتاه وسط اسپرینت'], votes: '۵' },
];

const steps = [
  { icon: 'users', title: 'تیم را دعوت کنید', text: 'یک جلسه بسازید و لینک برد را برای هم‌تیمی‌ها بفرستید. هر نفر با نام و آواتار خودش وارد می‌شود.' },
  { icon: 'group', title: 'بازخوردها را اولویت‌بندی کنید', text: 'یادداشت‌های نام‌دار یا ناشناس بگذارید، کارت‌های مرتبط را کنار هم جمع کنید و به موضوع‌های مهم رأی بدهید.' },
  { icon: 'target', title: 'با یک تصمیم روشن تمام کنید', text: 'برای هر اقدام مسئول و مهلت تعیین کنید و گزارش جلسه را برای پیگیری در Confluence کپی کنید.' },
];

export function Landing() {
  return <main className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="container landing-hero__inner">
        <p className="landing-hero__label">برد آنلاین رتروسپکتیو تیم</p>
        <h1 id="landing-title">اسپرینت تمام شد.<br /><span>حالا نوبت بهتر شدنه.</span></h1>
        <p className="landing-hero__description">با تیم مرور کنید چه گذشت، روی مهم‌ترین بازخوردها رأی بدهید و با اقدام‌های مشخص وارد اسپرینت بعد شوید.</p>
        <div className="landing-hero__actions">
          <a className="button button--primary landing-cta" href="/create"><Icon name="plus" />ساخت جلسهٔ رترو</a>
          <a className="button button--secondary landing-cta" href="#how-it-works"><span><bdi>RetroPulse</bdi> چطور کار می‌کند؟</span></a>
        </div>

        <figure className="landing-preview" aria-label="پیش‌نمایش برد نمونهٔ رتروسپکتیو">
          <div className="landing-preview__top">
            <div className="landing-preview__identity"><span className="brand__mark"><Icon name="logo" size={19} /></span><div><small>برد نمونه</small><strong>رتروی اسپرینت تیم محصول</strong></div></div>
            <div className="landing-preview__people">{[3, 25, 34].map(id => <Avatar key={id} id={id} />)}</div>
          </div>
          <div className="landing-preview__progress"><span>یادداشت‌ها</span><span>گروه‌بندی</span><strong>رأی‌گیری</strong><span>اقدام‌ها</span></div>
          <div className="landing-preview__columns">
            {preview.map(column => <div className="landing-preview__lane" data-tone={column.tone} key={column.tone}>
              <h2>{column.title}</h2>
              {column.notes.map((note, index) => <div className="landing-preview__note" key={note}>
                <p>{note}</p>
                {index === 0 && <span className="landing-preview__vote"><Icon name="vote" size={13} />{column.votes} رأی</span>}
              </div>)}
            </div>)}
          </div>
        </figure>
      </div>
    </section>

    <section className="container landing-how" id="how-it-works" aria-labelledby="landing-how-title">
      <div className="landing-how__intro">
        <h2 id="landing-how-title">از گفت‌وگو تا تصمیم تیمی</h2>
        <p><bdi>RetroPulse</bdi> فضای مشترکی برای مرور کار تیم است. یادداشت‌ها، رأی‌ها و مسئول هر اقدام در همان برد می‌مانند تا در جلسهٔ بعد بتوانید به آن‌ها برگردید.</p>
      </div>
      <ol className="landing-steps">
        {steps.map((step, index) => <li className="surface landing-step" key={step.title} data-tone={preview[index].tone}>
          <span className="landing-step__icon"><Icon name={step.icon} size={22} /></span>
          <h3>{step.title}</h3><p>{step.text}</p>
        </li>)}
      </ol>
      <div className="landing-end">
        <h2>رتروی بعدی را همین‌جا شروع کنید.</h2>
        <a className="button button--primary landing-cta" href="/create"><Icon name="plus" />ساخت جلسهٔ رترو</a>
      </div>
    </section>
  </main>;
}
