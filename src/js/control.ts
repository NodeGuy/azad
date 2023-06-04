/* Copyright(c) 2019 Philip Mulcahy. */

'use strict';

const $ = require('jquery');

import * as settings from './settings';
import * as util from './util';

$(document).ready(function() {
  $('body').on(
    'click',
    'a',
    function(event: Event) {
		  chrome.tabs.create({url: $(event.target).attr('href')});
		  return false;
	  }
  );
});

function activateIdle(): void {
    console.log('activateIdle');
    actionsShowOnly(['azad_clear_cache', 'azad_force_logout', 'azad_hide_controls']);
}

function activateScraping(years: number[]): void {
    console.log('activateScraping');
    actionsShowOnly(['azad_stop', 'azad_hide_controls']);
    $('#azad_state').text('scraping ' + years.join(','));
}

function activateDone(periods: number): void {
    console.log('activateDone');
    actionsShowOnly(['azad_clear_cache', 'azad_force_logout', 'azad_hide_controls']);
    $('#azad_state').text(periods);
}

function actionsShowOnly(button_ids: string[]): void {
    $('.azad_action').addClass('hidden');
    button_ids.forEach( id => $('#' + id).removeClass('hidden') );
}

function showNormalPage(): void {
  pagesShowOnly(['azad_page_actions', 'azad_page_default']);
}

function showExtensionPay(): void {
    pagesShowOnly(['azad_page_actions', 'azad_page_extensionpay']);
}

function pagesShowOnly(button_ids: string[]): void {
    $('.azad_control_page').addClass('hidden');
    button_ids.forEach( id => $('#' + id).removeClass('hidden') );
}

let background_port: chrome.runtime.Port|null = null;
function connectToBackground() {
    console.log('connectToBackground');

    // @ts-ignore: tsc objects to null first parameter for connect();
    background_port = chrome.runtime.connect(null, { name: 'azad_control' });

    background_port.onMessage.addListener( msg => {
        switch(msg.action) {
            case 'advertise_periods':
                console.info('control got periods advertisement');
                const months = (msg.periods as number[]).filter(p => p<=12);
                const years = (msg.periods as number[]).filter(p => p>=2000);
                showMonthsButtons(months);
                showYearButtons(years);
                break;
            case 'statistics_update':
                console.info('control got statistics update');
                {
                    const text = Object.entries(msg.statistics)
                        .map(([k,v]) => {return k + ':' + v;})
                        .join('; ');
                    $('#azad_statistics').text(text);
                    if ((msg.statistics.queued + msg.statistics.running) > 0) {
                        activateScraping(msg.purpose);
                    } else {
                        activateDone(msg.purpose);
                    }
                }
                break;
            case 'authorisation_status':
                console.info('control got authorisation_status message');
                const authorised = msg.authorisation_status;
                handleAuthorisationMessage(authorised);
                break;
            default:
                console.warn('unknown action: ' + msg.action);
        }
    });

    background_port.postMessage(
      {action: 'check_feature_authorized', feature_id: 'premium_preview'})
}

function handleAuthorisationMessage(authorised: boolean): void {
  const authorised_html = authorised ?
    'Preview/Premium features <b>enabled</b>' :
    'Preview/Premium features <b>disabled</b>';
  $('#azad_extensionpay_status').html(authorised_html);
}

function registerActionButtons() {
    $('#azad_clear_cache').on('click', () => {
      if (background_port) {
        console.log('clear cache clicked');
        background_port.postMessage({action: 'clear_cache'});
      } else {
        console.warn('clear cache clicked, but I have no background port');
      }
    });
    $('#azad_force_logout').on('click', () => {
      console.log('force logout clicked');
      if (background_port) {
        console.log('force logout clicked');
        background_port.postMessage({action: 'force_logout'});
      } else {
        console.warn('force logout clicked, but I have no background port');
      }
    });
    $('#azad_stop').on('click', () => {
      console.log('stop clicked');
      handleStopClick();
    });
    $('#azad_hide_controls').on('click', () => {
      console.log('closing popup');
      window.close();
    });
    $('#azad_payment_ui_button').on('click', () => {
      if (background_port) {
        console.log('show payment UI clicked')
        background_port.postMessage({action: 'show_payment_ui'});
      } else {
        console.warn('show payment UI clicked, but I have no background port');
      }
    });
    $('#azad_extpay_login_button').on('click', () => {
      if (background_port) {
        console.log('show payment UI clicked')
        background_port.postMessage({action: 'show_extpay_login_ui'});
      } else {
        console.warn('show extpay log-in UI clicked, but I have no background port');
      }
    });
}

function registerPageButtons(): void {
    showNormalPage();
    $('#azad_switch_extensionpay').on('click', () => {
      showExtensionPay();
    });

    $('#azad_switch_default').on('click', () => {
      showNormalPage();
    });
}

function showYearButtons(years: number[]) {
    console.log('show year buttons', years);
    $('.azad_year_button').remove();
    years.sort().reverse().forEach( year => {
        $('#azad_year_list').append(
            '<button class="azad_year_button" value="' + year + '">' + year + '</button>'
        );
    });
    $('.azad_year_button').on('click', handleYearClick);
}

function showMonthsButtons(month_counts: number[]) {
  console.log('show month buttons', month_counts);
  $('.azad_months_button').remove();
  month_counts.sort().forEach( month_count => {
    $('#azad_year_list').append(
      '<button class="azad_months_button" value="' + month_count + '" >' + month_count + 'm</button>' 
    );
  });
  $('.azad_months_button').on('click', handleMonthsClick);
}

function handleYearClick(evt: { target: { value: any; }; }) {
    const year = evt.target.value;
    const years = [year];
    activateScraping(years);
    if (background_port) {
        console.log('sending scrape_years', year);
        background_port.postMessage({
            action: 'scrape_years',
            years: years,
        });
    } else {
        console.warn('background_port not set');
    }
}

async function checkFeatureAuthorised(): Promise<boolean> {
	const authorised = await settings.getBoolean('preview_features_enabled');
  if (!authorised) {
		alert(
			'This capability is part of a preview feature set that will be ' +
			'released when charity donations reach a target set out in ' +
			'https://github.com/philipmulcahy/azad/blob/master/doc/commercial_features.md ' +
			'but you get early access by subscribing to the preview channel: ' +
			'click on the "preview features" button to find out more.'
		);
	};
	return authorised;
}

async function handleMonthsClick(evt: { target: { value: any; }; }) {
		const authorised = await checkFeatureAuthorised(); 
	  if (!authorised) {
			return;
		}
    const month_count = Number(evt.target.value);
    const end_date = new Date();
    const start_date = util.subtract_months(end_date, month_count);
    activateScraping([month_count]);
    if (background_port) {
        console.log('sending scrape_range', start_date, end_date);
        background_port.postMessage({
            action: 'scrape_range',
            start_date: start_date,
            end_date: end_date,
        });
    } else {
        console.warn('background_port not set');
    }
}

function handleStopClick() {
    if (background_port) {
        background_port.postMessage({action: 'abort'});
    }
}

function init() {
    settings.startMonitoringSettingsStorage();
    settings.initialiseUi();
    console.log('init');
    activateIdle();
    connectToBackground();
    registerActionButtons();
    registerPageButtons();
}

$(document).ready( () => init() );
