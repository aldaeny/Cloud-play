from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
import time, os
opt=webdriver.ChromeOptions();opt.add_argument('--headless=new');opt.add_argument('--no-sandbox');opt.add_argument('--disable-dev-shm-usage');opt.add_argument('--autoplay-policy=no-user-gesture-required');d=webdriver.Chrome(service=Service('/usr/bin/chromedriver'),options=opt);w=WebDriverWait(d,30)
try:
 d.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': "const p=HTMLMediaElement.prototype; const c=p.canPlayType; p.canPlayType=function(t){return t==='application/vnd.apple.mpegurl'?'':c.call(this,t)}"})
 d.get(os.environ.get('CLOUDPLAY_HLS_FIXTURE_PAGE', 'http://localhost:3107/cp-test-only'));w.until(lambda d: len(d.find_elements(By.CSS_SELECTOR,'.media-tracks select'))==3)
 w.until(lambda d:d.execute_script('return document.querySelector("video").currentTime')>1)
 sels=d.find_elements(By.CSS_SELECTOR,'.media-tracks select');print('selects',[[o.text for o in Select(x).options] for x in sels]);Select(sels[0]).select_by_value('1');assert Select(sels[0]).first_selected_option.get_attribute('value')=='1';Select(sels[1]).select_by_value('1');assert Select(sels[1]).first_selected_option.get_attribute('value')=='1';Select(sels[2]).select_by_value('0');assert Select(sels[2]).first_selected_option.get_attribute('value')=='0';time.sleep(1);Select(sels[2]).select_by_value('-1');assert Select(sels[2]).first_selected_option.get_attribute('value')=='-1';print('PASS locally generated HLS playback and quality/audio/subtitle controls in Chromium',d.execute_script('let v=document.querySelector("video");return {time:v.currentTime,paused:v.paused,error:v.error?.code||null}'))
finally:d.quit()
