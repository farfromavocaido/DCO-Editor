import {defineConfig} from 'vitest/config';
import base from './vitest.config';
import {browserTests} from './test-config/suites';
export default defineConfig({...base,test:{...base.test,include:browserTests}});
