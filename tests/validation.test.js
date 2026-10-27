import test from 'node:test'
import assert from 'node:assert/strict'
import { payloadError } from '../src/lib/plannerValidation.js'
const sample = () => ({revision:0,rangeStart:'2026-10-01',rangeEnd:'2026-10-31',customHolidayDates:[],projects:[{id:1,name:'테스트',tasks:[{id:2,dates:['2026-10-27'],redDates:[],artifactUrls:['https://example.com'],artifactUrl:'https://example.com'}]}]})
test('normal planner data passes',()=>assert.equal(payloadError(sample()),null))
test('invalid document link identifies project, task, and link index',()=>{
 const p=sample();p.projects[0].tasks[0].artifactUrls.push('www.example.com')
 assert.match(payloadError(p),/프로젝트 1.*업무 1.*문서 링크 2/)
})
test('duplicate task IDs are diagnosed without changing data',()=>{
 const p=sample();p.projects[0].tasks.push({...p.projects[0].tasks[0]});const before=JSON.stringify(p)
 assert.match(payloadError(p),/업무 2.*ID/);assert.equal(JSON.stringify(p),before)
})
test('normal and red schedules may share a date without data loss',()=>{
 const p=sample();p.projects[0].tasks[0].redDates=['2026-10-27'];const before=JSON.stringify(p)
 assert.equal(payloadError(p),null);assert.equal(JSON.stringify(p),before)
})
test('impossible dates are still rejected',()=>{
 const p=sample();p.projects[0].tasks[0].redDates=['2026-02-30'];assert.match(payloadError(p),/실제 존재/)
})
