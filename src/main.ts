import '@angular/localize/init';
import {loadTranslations} from '@angular/localize';
import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {App} from './app/app';

loadTranslations({
  svgScriptHrefUrl: '/svg-script-payload.js',
  svgScriptXlinkHrefUrl: '/svg-script-payload.js',
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
