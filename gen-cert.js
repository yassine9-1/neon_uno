const forge = require('node-forge');
const fs = require('fs');
const pki = forge.pki;

console.log('Generating 2048-bit key-pair...');
const keys = pki.rsa.generateKeyPair(2048);

console.log('Creating self-signed certificate...');
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{
    name: 'commonName',
    value: 'localhost'
}];
cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
}, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
}, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
}, {
    name: 'subjectAltName',
    altNames: [{
        type: 2, // DNS
        value: 'localhost'
    }, {
        type: 7, // IP
        ip: '127.0.0.1'
    }]
}]);

// sign the certificate
cert.sign(keys.privateKey, forge.md.sha256.create());

// PEM-format
const pemCert = pki.certificateToPem(cert);
const pemKey = pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync('cert.pem', pemCert);
fs.writeFileSync('key.pem', pemKey);

console.log('cert.pem and key.pem generated successfully.');
