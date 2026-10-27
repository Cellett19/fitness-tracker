
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../services/supabase';

type AuthScreenProps = {
  passwordRecovery?: boolean;
  onPasswordResetComplete?: () => void;
};

export default function AuthScreen({
  passwordRecovery = false,
  onPasswordResetComplete,
}: AuthScreenProps) {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (passwordRecovery) {
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  }, [passwordRecovery]);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showMessage('Missing details', 'Enter your email and password.');
      return;
    }

    if (isSigningUp && !confirmPassword) {
      showMessage('Missing details', 'Please confirm your password.');
      return;
    }

    if (password.length < 6) {
      showMessage(
        'Password too short',
        'Your password must be at least 6 characters.',
      );
      return;
    }

    if (isSigningUp && password !== confirmPassword) {
      showMessage(
        'Passwords do not match',
        'Please enter matching passwords.',
      );
      return;
    }

    setLoading(true);

    try {
      if (isSigningUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        setPassword('');
        setConfirmPassword('');

        if (!data.session) {
          showMessage(
            'Account created',
            'If email confirmation is enabled, check your inbox before signing in.',
          );
          setIsSigningUp(false);
        } else {
          showMessage(
            'Account created',
            'Your account has been created successfully.',
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      showMessage('Authentication error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      showMessage(
        'Enter your email',
        'Enter your email address above first, then tap Forgot password.',
      );
      return;
    }

    if (Platform.OS !== 'web') {
      showMessage(
        'Password reset',
        'Please request a password reset from the web version of the app.',
      );
      return;
    }

    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/?reset-password=true`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo },
      );

      if (error) throw error;

      showMessage(
        'Check your email',
        'If an account exists for that email address, you should receive a password reset email. Check your inbox and spam folder.',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not send the reset email. Please try again.';

      showMessage('Password reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      showMessage(
        'Missing details',
        'Enter and confirm your new password.',
      );
      return;
    }

    if (newPassword.length < 6) {
      showMessage(
        'Password too short',
        'Your new password must be at least 6 characters.',
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showMessage(
        'Passwords do not match',
        'Make sure both new password fields match.',
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.warn(
          'Password updated, but sign-out failed:',
          signOutError.message,
        );
      }

      setNewPassword('');
      setConfirmNewPassword('');

      showMessage(
        'Password updated',
        'Your password has been changed. You can now sign in using your new password.',
      );

      onPasswordResetComplete?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not update your password. Request a new reset link and try again.';

      showMessage('Password reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSigningUp(!isSigningUp);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FT</Text>
        </View>

        <Text style={styles.title}>Fitness Tracker</Text>

        <Text style={styles.subtitle}>
          {passwordRecovery
            ? 'Choose a new password for your account.'
            : isSigningUp
              ? 'Create your account and start tracking your progress.'
              : 'Sign in to continue your fitness journey.'}
        </Text>

        <View style={styles.form}>
          {passwordRecovery ? (
            <>
              <Text style={styles.sectionTitle}>Reset password</Text>

              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your new password"
                placeholderTextColor="#888888"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
              />

              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your new password"
                placeholderTextColor="#888888"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
              />

              <Text style={styles.helperText}>
                Your password must be at least 6 characters.
              </Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleUpdatePassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#101010" />
                ) : (
                  <Text style={styles.buttonText}>Update password</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {isSigningUp ? 'Create account' : 'Welcome back'}
              </Text>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#888888"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                editable={!loading}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#888888"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType={isSigningUp ? 'newPassword' : 'password'}
                autoComplete={
                  isSigningUp ? 'new-password' : 'current-password'
                }
                editable={!loading}
              />

              {!isSigningUp && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={handleForgotPassword}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {isSigningUp && (
                <>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#888888"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    editable={!loading}
                  />

                  <Text style={styles.helperText}>
                    Your password must be at least 6 characters.
                  </Text>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleAuth}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#101010" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isSigningUp ? 'Create account' : 'Sign in'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchPrompt}>
                  {isSigningUp
                    ? 'Already have an account?'
                    : "Don't have an account?"}
                </Text>

                <TouchableOpacity
                  onPress={switchMode}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchText}>
                    {isSigningUp ? ' Sign in' : ' Create account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          Your fitness journey, all in one place.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#72D6A0',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logo: {
    color: '#101010',
    fontSize: 25,
    fontWeight: '900',
  },
  title: {
    color: '#72D6A0',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#A0A0A0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  form: {
    backgroundColor: '#1B1B1B',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 24,
  },
  label: {
    color: '#DADADA',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252525',
    color: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 15,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#333333',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 18,
    paddingVertical: 5,
    paddingLeft: 10,
  },
  forgotText: {
    color: '#72D6A0',
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    color: '#999999',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#72D6A0',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 54,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#101010',
    fontSize: 16,
    fontWeight: '800',
  },
  switchContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  switchPrompt: {
    color: '#A0A0A0',
    fontSize: 14,
  },
  switchText: {
    color: '#72D6A0',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
  },
});
