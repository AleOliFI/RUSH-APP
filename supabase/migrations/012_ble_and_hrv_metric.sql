-- 012_ble_and_hrv_metric.sql
-- Medição passa a vir de dispositivos Bluetooth (cintas/relógios com GATT
-- Heart Rate) e de plataformas de saúde, no lugar da câmera.
--
-- Cintas BLE entregam intervalos RR, então calculamos RMSSD. O Apple Health
-- só publica SDNN. As duas métricas NÃO são intercambiáveis: 40 ms de SDNN e
-- 40 ms de RMSSD não significam a mesma coisa. A coluna hrv_metric registra
-- qual delas a leitura carrega, para que as baselines (µ28/σ28) sejam sempre
-- calculadas dentro da mesma métrica.

alter table public.hrv_readings
  add column if not exists hrv_metric text not null default 'rmssd'
    check (hrv_metric in ('rmssd', 'sdnn'));

-- Métodos de medição: sai a câmera/acelerômetro, entra o BLE.
alter table public.hrv_readings
  drop constraint if exists hrv_readings_measurement_method_check;

alter table public.hrv_readings
  add constraint hrv_readings_measurement_method_check
  check (
    measurement_method in (
      'ble_hrm', 'strava', 'garmin', 'apple_health', 'google_fit', 'manual'
    )
  );

-- Leituras antigas da câmera eram geradas a partir de sinal sintético: o
-- pipeline PPG nunca leu a câmera de fato. Mantê-las corromperia as baselines
-- de quem já usou o app, então são descartadas.
delete from public.hrv_readings
  where measurement_method in ('camera_ppg', 'accelerometer_scg');

-- Avaliações órfãs (o hrv_reading_id apontava para as leituras removidas).
delete from public.readiness_assessments
  where hrv_reading_id is not null
    and hrv_reading_id not in (select id from public.hrv_readings);

-- Baselines são consultadas por (user_id, métrica, data).
create index if not exists hrv_readings_user_metric_date_idx
  on public.hrv_readings (user_id, hrv_metric, measured_at desc);
