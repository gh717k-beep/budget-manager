# Welcome to your Expo app 👋

## Android 금융 알림 자동 기록

이 기능은 Expo Go에서 동작하지 않으며 Android Development Build가 필요합니다. Expo SDK 57은 React Native 0.86을 사용하므로 Node.js 22.13 이상 환경에서 아래 명령을 실행하세요.

```bash
npx expo install @react-native-async-storage/async-storage
npx expo run:android
```

앱 설치 후 `앱 선택` 탭에서 금융 앱을 켜고 `알림 로그` 탭의 `권한 설정`에서 Project1의 알림 접근 권한을 허용해야 합니다. Android의 알림 접근 권한은 일반 런타임 권한이 아니므로 `app.json`의 `POST_NOTIFICATIONS`만으로는 활성화되지 않습니다. 현재 Android 서비스 선언은 `android/app/src/main/AndroidManifest.xml`에 있으며, 네이티브 코드 변경 후에는 반드시 Development Build를 다시 설치해야 합니다.

알림은 선택한 패키지와 일치하는 경우에만 처리됩니다. `결제거부`, `승인거부`, `잔액부족`은 제외하고 `입금`, `취소`는 수입, `결제`, `출금`은 지출로 기록합니다. 금액은 `1,234원` 형식만 자동 인식하며 가맹점명은 알림 본문의 첫 번째 비금융 텍스트를 사용합니다.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
