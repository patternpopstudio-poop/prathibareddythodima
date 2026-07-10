# teleconsultApp

Hospital Tele-Consulting Platform mobile app.

It is logically split into two primary user flows: **Patient** and **Doctor**.

Built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/).

## Project structure

```
.
├── src/
│   ├── app/          # Screens (file-based routing)
│   ├── components/   # Reusable UI components
│   ├── hooks/        # Custom React hooks
│   └── constants/    # Theme and shared constants
├── assets/           # Images, icons, and static assets
└── scripts/          # Project utility scripts
```

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm start
   ```

   From the Expo dev tools you can open the app in:

   - [development build](https://docs.expo.dev/develop/development-builds/introduction/)
   - [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
   - [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
   - [Expo Go](https://expo.dev/go)

### Useful commands

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Start on Android |
| `npm run ios` | Start on iOS |
| `npm run web` | Start on web |
| `npm run lint` | Run ESLint |

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
