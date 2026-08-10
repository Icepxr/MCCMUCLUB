insert into settings (key, value)
select r->>'key' as key,
       coalesce(r->>'value','') as value
from jsonb_array_elements($j$[{"key":"about_hero_id","value":"1BQqbY-Yg03tyWfLX5iEuolXhUD-f1x_N"},{"key":"club_email","value":""},{"key":"club_facebook","value":""},{"key":"club_instagram","value":""},{"key":"club_line","value":""},{"key":"club_youtube","value":""},{"key":"halal_map_url","value":"https://www.google.com/maps/d/u/0/embed?mid=1ete_17T4Y4H4B7WstYy9resVfwdJ9eA&ehbc=2E312F&noprof=1"},{"key":"logo_id","value":""},{"key":"map_embed_url","value":""},{"key":"prayer_method","value":"2"}]$j$::jsonb) as r
on conflict (key) do update set value=excluded.value;
