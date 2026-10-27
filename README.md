# Fitness Tracker

A personal fitness tracking application built with **React Native, Expo and Supabase**. The app brings calorie and macronutrient tracking, food management, workout planning, gym session logging and fitness progress into one place.

The goal is to make tracking nutrition and training straightforward, with a dark interface, persistent user data and tools for monitoring progress over time.

## Live Demo

**Try Fitness Tracker online:** [https://fitness-tracker-iota-pink.vercel.app](https://fitness-tracker-iota-pink.vercel.app)

The application is deployed on Vercel and can be accessed through a web browser without installing the mobile app.

Explore the interface and experience the fitness tracking features, including nutrition logging, workout management and progress tracking, where available in the current deployment.

> **Note:** Some features may behave differently in the web version compared with the iOS or Android app. Access to certain functionality may require an account.

## Features

### Dashboard

The Dashboard provides an overview of the user's fitness activity and recorded data.

- Access to the main nutrition, workout and progress features.
- Overview of relevant food diary and completed workout information.
- Navigation between the app's main sections.



### Food Diary

Track daily food intake and monitor calories and macronutrients.

- Log foods against a selected date.
- Organise food entries by meal.
- Record the quantity consumed in grams.
- Calculate calories, protein, carbohydrates and fat based on the quantity logged.
- View daily calorie and macronutrient totals.
- Edit existing food entries.
- Delete food entries.
- Navigate between dates to review previous diary entries.
- Persist food logs using Supabase.

Food entries store nutrition information alongside the logged quantity, allowing previously recorded entries to retain their nutritional values even if a food's library information changes.

### Food Library

Search for foods, create custom entries and reuse foods in the diary.

- Browse and search available foods.
- Search external food databases through the app's food-search integration.
- Use food information from sources including USDA FoodData Central and Open Food Facts, where available.
- Create custom foods with nutritional information.
- Maintain a personal collection of saved foods.
- Calculate nutritional values based on the quantity selected.
- Select a meal and add foods directly to the food diary.
- Scan food barcodes where supported by the configured camera and food database integrations.

Nutrition values are handled on a per-100-gram basis where applicable, allowing the app to calculate the nutritional contribution of different serving quantities.

### Workouts

Plan training sessions and record gym performance.

- Create and manage workout routines.
- Add exercises to routines using the exercise picker.
- Configure sets, repetitions, weights and rest periods.
- Edit workout set details during a session.
- Mark sets as completed.
- Start and finish workout sessions.
- Save completed workout data for future reference.
- Review previous workout sessions.
- Use previous performance to help populate exercise and set information for subsequent sessions.
- Delete workout records where supported.
- Use a rest timer during training, with notification support where available and permitted.



#### Exercise picker

The exercise picker integrates with the ExerciseDB API:

`https://oss.exercisedb.dev/api/v1/exercises`

It supports browsing exercises, pagination, filtering by muscle group and equipment, and preventing duplicate exercises from being added to a routine.

#### Workout history

Workout sessions and set records are persisted through Supabase. Recorded performance can be used to review previous sessions and track improvements in training.

### Progress

The Progress section provides a view of recorded training performance to help users assess changes over time.

- Review available exercise performance data.
- Identify recorded weight values for exercises.
- View recent performance information based on stored workout history.

Progress insights depend on the workout history available in the database. They should not be interpreted as a complete historical analytics system unless the relevant historical comparisons have been implemented.

### Authentication and Settings

The application uses Supabase Authentication to support user accounts and access to the app.

- Authenticate users through Supabase.
- Keep user-specific information associated with the relevant account.
- Refresh authentication state when returning to the app.
- Access account and application settings through the Settings section.

The main navigation uses bottom tabs for Dashboard, Food, Food Library, Workouts and Progress, with Settings accessible separately.

## Technology Stack


| Technology              | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| React Native            | Cross-platform mobile application UI            |
| Expo                    | Application development and platform tooling    |
| TypeScript              | Typed application development                   |
| Supabase                | Authentication, database and backend services   |
| PostgreSQL              | Relational data storage through Supabase        |
| Supabase Edge Functions | Server-side integrations, including food search |
| ExerciseDB API          | Exercise catalogue data                         |
| USDA FoodData Central   | External food and nutrition data                |
| Open Food Facts         | Food product and barcode information            |
| Expo Camera             | Camera access for supported scanning features   |
| Expo Notifications      | Rest timer notification support                 |
| AsyncStorage            | Local persistence where configured              |
| React Navigation        | Bottom-tab navigation                           |
| React Native SVG        | Vector graphics and interface elements          |




## Application Structure

The application is organised around separate screens and reusable functionality.

The main screens include:

- **Dashboard** — overview of recorded activity.
- **Food** — daily food diary and nutrition totals.
- **Food Library** — food search, custom foods and saved foods.
- **Workouts** — routine creation, exercise selection and training sessions.
- **Progress** — exercise performance and progress information.
- **Settings** — account and application settings.

Workout functionality is implemented in `WorkoutScreen.tsx`, with the exercise picker in `ExercisePickerScreen.tsx`. Other screens are organised into their respective components and application directories.

Exact file locations may vary as the project evolves.

## Backend and Data Storage

Supabase provides the application's authentication and persistent data storage.

Known food-related tables include:

- `foods` — available food records.
- `user_foods` — foods saved or created by individual users.
- `food_logs` — foods recorded in the diary, including quantities, meal information, dates and nutrition snapshots.

Workout persistence includes:

- `workout_sessions` — recorded workout sessions.
- `workout_sets` — recorded set-level training information.

Additional tables may be used for routines, routine exercises, profiles or other functionality depending on the current Supabase schema.

### Data security

Supabase Row Level Security (RLS) policies should be configured so users can access only the records they are authorised to view or modify.

The client application should use the Supabase publishable key, not a privileged service-role key. Server-side API credentials should remain in Supabase Edge Function secrets or another appropriate secure environment.

The live Supabase schema and its RLS policies are the source of truth for the deployed backend.

## Getting Started



### Prerequisites

Before running the project, install:

- [Node.js](https://nodejs.org/)
- npm
- [Git](https://git-scm.com/)
- An Expo-compatible development environment or the Expo Go app
- A Supabase project with the required database tables, authentication configuration and backend functions



### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

Replace the placeholders with your repository URL and local project directory.

### 2. Install dependencies

```bash
npm install
```

If dependencies or platform packages need to be aligned with the installed Expo SDK, use:

```bash
npx expo install
```

Install any missing platform-specific packages as required by the current project configuration.

### 3. Configure environment variables

Create a `.env` file in the project root and configure the Supabase connection:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use the actual values from your Supabase project.

If the food-search Edge Function uses USDA FoodData Central, configure its API key as a **server-side Supabase secret**:

```bash
supabase secrets set USDA_API_KEY=your_usda_api_key
```

This command requires the Supabase CLI and a linked or otherwise correctly targeted Supabase project.

Do not commit real API keys, passwords, access tokens or other secrets to GitHub. Public Expo environment variables are bundled into the client application and must not contain privileged credentials.

### 4. Configure Supabase

Make sure your Supabase project has:

- Authentication configured for the app's sign-in flow.
- The required food and food diary tables.
- The required workout session and set tables.
- Any additional routine or user-related tables used by the current application.
- Appropriate RLS policies and database permissions.
- The food-search Edge Function and its required secrets, if external food search is enabled.
- Correct authentication redirect URLs for the platforms you intend to use.

The database schema must match the queries and insert/update operations used by the current source code.

### 5. Start the application

Start the Expo development server:

```bash
npx expo start
```

Follow the terminal instructions to open the app on a connected device, emulator or supported development environment.

For web development, install the required web packages if they are not already present:

```bash
npx expo install react-dom react-native-web @expo/metro-runtime
```

Then run:

```bash
npx expo start --web
```



## Available Scripts

The project has used the following npm scripts:


| Command           | Purpose                                |
| ----------------- | -------------------------------------- |
| `npm start`       | Start the Expo development server      |
| `npm run android` | Start the Android development workflow |
| `npm run ios`     | Start the iOS development workflow     |
| `npm run web`     | Start the web development workflow     |


The commands depend on the scripts currently defined in `package.json`.

## Design

The application uses a dark interface intended for regular use while eating, training and reviewing progress.

- Dark background: `#111111`
- Purple workout accent: `#7C5CFC`
- Green accent used in the main application interface: `#72D6A0`

The design prioritises readable information, straightforward navigation, clear data entry and convenient access to frequently used tracking features.

## Current Limitations

The app is an evolving personal project. Its behaviour depends on the current source code, Supabase configuration and availability of external services.

Potential limitations include:

- Food database results depend on external API availability and the quality of the source data.
- Barcode lookups depend on the product being present in the supported database.
- Rest timer notifications depend on device permissions and platform capabilities.
- Progress insights depend on the completeness of saved workout history.
- Historical analytics may be limited to the comparisons currently implemented.
- Web and native platforms may differ in camera, notification and authentication behaviour.
- A working local app does not automatically mean a fresh installation has all the required backend configuration.

Features and limitations should be updated as development continues.

## Future Improvements

Potential areas for further development include:

- More detailed workout progress charts and historical comparisons.
- Improved personal records and strength progression summaries.
- Expanded nutrition reporting and daily target tracking.
- Additional food database integrations and more robust barcode coverage.
- Improved handling of loading states, network errors and offline scenarios.
- More comprehensive automated tests.
- Additional account, privacy and data-management controls.

These are potential enhancements rather than a statement that they are already implemented.

## Security and Privacy

The application handles account-specific nutrition and workout records. Backend access should be restricted using appropriate Supabase authentication and RLS policies.

- Never commit secrets or credentials to the repository.
- Keep privileged API keys on the server.
- Validate and authorise database operations.
- Restrict users' access to their own records where appropriate.
- Review external API data handling and privacy implications before deploying publicly.



## Development

This project is developed iteratively, with new screens and functionality added as the application grows.

When contributing or making changes:

1. Review the existing component and database structure before changing functionality.
2. Test changes on the platforms affected by the change.
3. Check that existing food logs and workout records continue to work.
4. Review the Git diff before committing to avoid unrelated changes.
5. Confirm that environment variables and backend configuration are documented without exposing secrets.



## Licence

No licence has been specified yet. Add a `LICENSE` file if you intend to distribute the project under an open-source licence.

---

**Fitness Tracker** — one place to manage nutrition, plan workouts, record gym sessions and follow fitness progress.