import {expect,it} from 'vitest';
import {suggestTopic,type TopicSuggestion} from '../src/domain/topic-suggestions';
import {resolveAction} from '../src/domain/router';
import {resolveUiCommand} from '../src/line/render';
import ui from '../content/ui.json';
import routes from '../content/routes.json';
import aliases from '../content/aliases.json';

const lab:TopicSuggestion = {label:'การเจาะเลือด',terms:['เจาะเลือด','การเจาะเลือด'],postbackId:'lab.source.ic04'};

it.each(['เจาะเลืด','เจาะเลืิอด','เจาะเลืาด','จาะเลือด','เจาะเลือ','  เจาะเลืด\n'])('suggests one approved topic for one insertion/deletion/substitution: %s',value => {
  expect(suggestTopic(value,[lab])?.postbackId).toBe('lab.source.ic04');
});
it.each(['เจเลืด','เลือด','ช่วยเจาะเลือด','เจาะเลือด ผลลบ','เจาะเลือด-','เจาะเลือด1','เจาะเลือด๑','เจาะเลือดHBIG','เจาะเลือด💉',''])('does not autocorrect fragments, sentences, numbers, codes or punctuation: %s',value => {
  expect(suggestTopic(value,[lab])).toBeNull();
});
it('bounds long input before attempting topic comparison',() => {
  expect(suggestTopic('เจาะ'.repeat(1000),[lab])).toBeNull();
});
it('refuses a short near match even if a short term is mistakenly configured',() => {
  expect(suggestTopic('ผลบว',[{label:'test',terms:['ผลบวก'],postbackId:'test'}])).toBeNull();
});
it('returns no suggestion when multiple distinct topics are equally close',() => {
  const topics:TopicSuggestion[] = [
    {label:'สมุดงาน',terms:['สมุดงาน'],postbackId:'topic.one'},
    {label:'สมุดจาน',terms:['สมุดจาน'],postbackId:'topic.two'},
  ];
  expect(suggestTopic('สมุดกาน',topics)).toBeNull();
});
it('counts several matching terms of the same topic as one suggestion',() => {
  expect(suggestTopic('เจาะเลืด',[{...lab,terms:['เจาะเลือด','เจาะเลืด']}])?.postbackId).toBe('lab.source.ic04');
});
it('offers only existing top-level menu targets whose exact terms retain the same destination',() => {
  for (const topic of ui.topicSuggestions) {
    expect(ui.mainMenu.some(item => item.routeId === topic.postbackId)).toBe(true);
    for (const term of topic.terms) {
      const command = resolveUiCommand({kind:'text',value:term});
      if (topic.postbackId.startsWith('ui.')) {
        expect(`ui.${command}`).toBe(topic.postbackId);
      } else {
        expect(command).toBeNull();
        const result = resolveAction({kind:'text',value:term},routes,aliases);
        expect(result.kind).toBe('route');
        if (result.kind === 'route') expect(result.route.routeId).toBe(topic.postbackId);
      }
    }
  }
});
