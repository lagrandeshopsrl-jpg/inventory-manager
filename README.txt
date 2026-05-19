Inventory Manager v60 - Dropbox fix completo

File da caricare nella root del repository:
- index.html
- style.css
- app.js

Note:
- Supabase non viene più usato dall'app.
- setup_cloud.sql resta solo come vecchio riferimento, non serve per questa versione.
- Il token Dropbox si inserisce da Impostazioni nel browser.
- Puoi collegare Dropbox direttamente con il pulsante "Collega Dropbox" usando OAuth.
- Per OAuth serve App Key e l'app deve essere aperta da un URL http/https registrato come Redirect URI in Dropbox.
- Il file dati predefinito su Dropbox è /inventory_manager_snapshot.json.
- A ogni upload viene creato anche un backup nuovo in /inventory_manager_backups.
- I backup hanno data e ora nel nome e non sovrascrivono quelli precedenti.
