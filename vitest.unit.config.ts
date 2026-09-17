import {defineConfig} from 'vitest/config';
import base from './vitest.config';
import {browserTests,exclusions} from './test-config/suites';
export default defineConfig({...base,test:{...base.test,exclude:[...exclusions,...browserTests]}});
