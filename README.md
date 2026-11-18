# Capibara Traductor — plugin de Kino

Lector de **mangas** de [CapibaraTraductor](https://capibaratraductor.com/) para [Kino](https://kinotvapp.github.io/).

Arquitectura **solo pantalla** (como [Yuri Online](https://github.com/yumehotaru41-rgb/Kino-plugin-manga-Yuri-Online)): no expone ítems `series`/`movie` al catálogo de vídeo de Kino.

- **Autor:** Hotaru Yume (`hotaruyume`)
- **Versión:** 3.0.0
- **apiVersion:** 14 (`screen` + `shared`)

## Qué incluye

- **Inicio:** filas Destacados, Últimos y Populares
- **Búsqueda** por título
- **Detalle** con capítulos ordenados de menor a mayor
- **Lector** en tira vertical (y modo páginas si Kino lo soporta)
- Descifrado de páginas (`ph` / `ls`) y header `x-organization`

## Instalar

En Kino → Ajustes → Plugins:

```
owner/repo
```

Topic de GitHub: `kino-plugin`.

## Uso

Menú de Kino → **Capibara** → elige un manga → capítulo. Todo ocurre dentro de la pantalla del plugin.
