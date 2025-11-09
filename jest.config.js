module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    testMatch: ["**/tests/**/*.test.ts"],
    moduleDirectories: ["node_modules", "src"],
    testTimeout: 30000
};
