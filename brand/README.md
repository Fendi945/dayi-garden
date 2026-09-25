# DAYI Brand Component

Status: LOCKED
Standard: DAYI UI SYSTEM V1.6

## Single source of truth

All production web pages must use:

```html
<script src="/dayi-garden/brand/dayi-brand.js"></script>
<dayi-brand></dayi-brand>
```

For the Chinese lockup:

```html
<dayi-brand cn></dayi-brand>
```

Do not recreate the logo with page-specific HTML/CSS.

## Locked visual rules

- wordmark: `dayi`
- never `day1`
- Georgia / Times New Roman / serif
- warm black: #222222
- brick red: #C6402F
- desktop wordmark: 28px
- desktop red dot: 6px
- red dot top: -5px
- mobile wordmark: 25px
- mobile red dot: ~5px
- Chinese lockup gap: 28px
- no separator dot or symbol between `dayi` and `大一造园`
- no second dot
- no page-level override of dot position, size, or brand color

## Engineering rule

The component is the brand asset. New pages may only reference it; they may not draw another logo.
