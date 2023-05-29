enum LitActionType {
    Call,
    Sign
}

enum ProviderType {
	Discord = "discord",
	Google = "google",
	EthWallet = "ethwallet",
	WebAuthn = "webauthn",
	Otp = "otp"
}

export {
    ProviderType,
    LitActionType
}