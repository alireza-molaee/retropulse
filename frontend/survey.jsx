import React, { useState } from 'react';
import { surveyLimits, surveyTemplates } from '../surveys.js';
import { Badge, Button, Dialog, Field, Icon, Switch } from './design-system.jsx';

const number = new Intl.NumberFormat('fa').format;
const percent = new Intl.NumberFormat('fa', { style: 'percent', maximumFractionDigits: 1 }).format;
const blankQuestion = () => ({ text: '', options: ['', ''] });

export function SurveyBuilder({ questions, onChange }) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  function replaceQuestion(index, value) {
    onChange(questions.map((question, current) => current === index ? value : question));
  }
  return <div className="survey-builder">
    <Switch checked={Boolean(questions)} onChange={event => {
      setSelectedTemplate('');
      onChange(event.target.checked ? [blankQuestion()] : null);
    }}>افزودن نظرسنجی</Switch>
    {questions && <>
      <div className="survey-templates" role="group" aria-label="الگوهای نظرسنجی">
        {surveyTemplates.map(template => <Button key={template.title} variant={selectedTemplate === template.title ? 'soft' : 'secondary'}
          aria-pressed={selectedTemplate === template.title} onClick={() => {
            setSelectedTemplate(template.title);
            onChange(template.questions);
          }}>{template.title}</Button>)}
      </div>
      {questions.map((question, index) => <fieldset className="survey-question" key={index}>
        <legend>سؤال {number(index + 1)}</legend>
        <Field label="متن سؤال" value={question.text} maxLength={surveyLimits.questionLength} required
          onChange={event => replaceQuestion(index, { ...question, text: event.target.value })} />
        {question.options.map((option, key) => <div className="survey-option-editor" key={key}>
          <Field label={'گزینهٔ ' + number(key + 1)} value={option} maxLength={surveyLimits.optionLength}
            required onChange={event => replaceQuestion(index, {
              ...question, options: question.options.map((item, current) => current === key ? event.target.value : item),
            })} />
          {question.options.length > 2 && <Button variant="ghost" icon="trash" aria-label={'حذف گزینهٔ ' + number(key + 1)}
            onClick={() => replaceQuestion(index, { ...question, options: question.options.filter((_, current) => current !== key) })} />}
        </div>)}
        <div className="survey-controls">
          {question.options.length < surveyLimits.options && <Button icon="plus" onClick={() => replaceQuestion(index, {
            ...question, options: [...question.options, ''],
          })}>افزودن گزینه</Button>}
          {questions.length > 1 && <Button variant="ghost" icon="trash"
            onClick={() => onChange(questions.filter((_, current) => current !== index))}>حذف سؤال</Button>}
        </div>
      </fieldset>)}
      {questions.length < surveyLimits.questions && <Button className="survey-builder__add" icon="plus"
        onClick={() => onChange([...questions, blankQuestion()])}>افزودن سؤال</Button>}
    </>}
  </div>;
}

export function SurveyForm({ survey, pending, change, error, onClose }) {
  const [attempted, setAttempted] = useState(false);
  return <Dialog title="نظرسنجی جلسه" onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const answers = survey.questions.map((_, index) => Number(fields.get('question-' + index)));
      setAttempted(true);
      if (await change('survey-response', { answers })) onClose();
    }}>
      {survey.questions.map((question, index) => <fieldset className="survey-question" key={index}>
        <legend>{question.text}</legend>
        {question.options.map((option, key) => <label className="survey-radio" key={key}>
          <input type="radio" name={'question-' + index} value={key} defaultChecked={survey.answers?.[index] === key} required />
          <span>{option}</span>
        </label>)}
      </fieldset>)}
      {attempted && error && <p className="dialog__error" role="alert">{error}</p>}
      <div className="dialog__actions">
        <Button variant="primary" icon="check" type="submit" disabled={pending}>ثبت پاسخ‌ها</Button>
      </div>
    </form>
  </Dialog>;
}

export function SurveyResults({ survey }) {
  const { respondents, counts } = survey.results;
  return <section className="survey-results surface" aria-labelledby="survey-results-title">
    <div className="section-title">
      <span className="stage__icon"><Icon name="survey" /></span>
      <h2 id="survey-results-title">نتایج نظرسنجی</h2>
      <Badge>{number(respondents)} پاسخ‌دهنده</Badge>
    </div>
    {respondents === 0 && <p className="survey-results__empty">هیچ پاسخی برای این نظرسنجی ثبت نشده است.</p>}
    <div className="survey-results__grid">
      {survey.questions.map((question, index) => <section className="survey-question" key={index}>
        <h3 dir="auto">{question.text}</h3>
        <ul className="survey-chart">
          {question.options.map((option, key) => {
            const count = counts[index][key];
            const share = respondents ? count / respondents : 0;
            return <li key={key}>
              <div className="survey-chart__row"><span dir="auto">{option}</span><span>{number(count)} رأی · {percent(share)}</span></div>
              <div className="survey-chart__track" aria-hidden="true"><span style={{ width: (share * 100) + '%' }} /></div>
            </li>;
          })}
        </ul>
      </section>)}
    </div>
  </section>;
}
