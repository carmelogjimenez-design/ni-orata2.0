# NIÑORATA 2.0 — Pasos para conectar todo

## 🚨 ANTES DE NADA: Resetea tu password de Supabase

Carmelo, la contraseña que pegaste en el chat ya no es segura. Ve YA a:
**Supabase → Project Settings → Database → "Reset database password"**
Genera una nueva y guárdala solo en un sitio seguro (1Password, una nota local, etc).

No me la mandes. **No la necesito.**

---

## Lo que vas a hacer hoy (15 minutos)

### Paso 1: Subir los archivos nuevos a tu repo de GitHub

Tienes que añadir 4 archivos a tu repo:

```
api/remove-background.js     (nuevo)
api/generate-background.js   (nuevo)
package.json                 (nuevo)
vercel.json                  (nuevo)
index.html                   (reemplazar el que ya tienes)
```

**Cómo hacerlo desde la web de GitHub:**

1. Entra a tu repo `ninorata` en GitHub
2. Click en **"Add file" → "Upload files"** (botón arriba a la derecha)
3. Arrastra los 4 archivos nuevos + el `index.html` actualizado
4. Abajo, mensaje: "conectar IA y supabase"
5. Click **"Commit changes"**

### Paso 2: Pegar tus claves de Supabase en index.html

Necesito que abras `index.html` directamente en GitHub y edites dos líneas:

1. En tu repo, click en `index.html`
2. Click en el icono del **lápiz** ✏️ (arriba a la derecha del archivo)
3. Busca con Cmd+F estas dos líneas (están casi al final, dentro del `<script>`):

```js
const SUPABASE_URL = 'PEGA_AQUI_TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_SUPABASE_ANON_KEY';
```

4. Sustituye `PEGA_AQUI_TU_SUPABASE_URL` por tu URL real (la que sale en Supabase → Settings → API → Project URL)
5. Sustituye `PEGA_AQUI_TU_SUPABASE_ANON_KEY` por tu anon key (Supabase → Settings → API → "anon · public")
6. Abajo del todo, click **"Commit changes"**

⚠️ Ambas claves son **seguras** de poner en el HTML público. Están diseñadas para eso. La que NO se pega aquí es la `service_role`.

### Paso 3: Pegar tu Replicate token en Vercel

1. Ve a https://replicate.com/account/api-tokens
2. **Create token** → ponle un nombre tipo "ninorata" → copia el token (empieza por `r8_`)
3. Ve a tu proyecto en Vercel → **Settings → Environment Variables**
4. Add new:
   - Key: `REPLICATE_API_TOKEN`
   - Value: pega el token `r8_xxx`
   - Environment: marca **Production**, **Preview** y **Development**
5. **Save**

### Paso 4: Forzar redeploy en Vercel

Como acabas de añadir la variable de entorno, Vercel necesita rehacer el deploy:

1. En Vercel → tu proyecto → tab **Deployments**
2. En el deploy más reciente, click en los **tres puntos `⋯` → "Redeploy"**
3. Espera ~1-2 minutos

### Paso 5: Probar que funciona

1. Abre tu URL de Vercel (ej. `ninorata-xxx.vercel.app`)
2. Click "Probar gratis" → te pedirá registrarte
3. Registra una cuenta con email + contraseña → te llegará un email de confirmación de Supabase (pincha)
4. Sube una foto cualquiera
5. Si todo va bien: la IA recorta el personaje en 2-4 segundos
6. Escribe "campo de fútbol al atardecer" → click "Generar 4" → en 10-15 segundos salen 4 fondos reales

---

## Si algo falla

**"REPLICATE_API_TOKEN no configurado"** → falta el paso 3 o 4 (variable de entorno + redeploy)

**"Failed to fetch" al subir imagen** → tu repo no tiene los archivos en `api/`. Revisa que están subidos al GitHub.

**El botón "Probar gratis" no abre el editor** → no pegaste bien las claves de Supabase en index.html. Vuelve al paso 2.

**Email no llega** → revisa la carpeta de spam. Si no, ve a Supabase → Authentication → Providers y verifica que "Email" está activado.

---

## Coste por uso

Cada vez que un usuario hace una creación completa:
- Recortar fondo: ~$0.003
- Generar 4 fondos: ~$0.012 (4 × $0.003 cada uno con FLUX schnell)
- **Total por creación: ~$0.015** (1,5 céntimos)

Con $5 en Replicate tienes para ~330 creaciones. Buen margen para probar.
