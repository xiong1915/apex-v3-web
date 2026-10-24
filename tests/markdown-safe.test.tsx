import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MarkdownRenderer} from '../components/markdown_renderer';
test('AI tables and safe source links render without allowing active content',()=>{
  const html=renderToStaticMarkup(<MarkdownRenderer content={'| 车手 | 积分 |\n| --- | --- |\n| Test | 100 |\n\n[官方来源](https://www.formula1.com/)\n[bad](javascript:alert)\n<script>alert(1)</script>'}/>);
  assert.match(html,/<table/);assert.match(html,/<th[^>]*>车手/);assert.match(html,/href="https:\/\/www.formula1.com\//);
  assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('<script>'));
});
