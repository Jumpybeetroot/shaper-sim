const M1 = 0.5; const M2 = 0.834; const K1 = 277539; const K2 = 2714141; 
const A = M1 * M2;
const B = -(M1*(K1+K2) + M2*K1);
const C = K1*K2;
const det = Math.sqrt(B*B - 4*A*C);
const w2_1 = (-B - det) / (2*A);
const w2_2 = (-B + det) / (2*A);
console.log("Freq 1:", Math.sqrt(w2_1) / (2 * Math.PI));
console.log("Freq 2:", Math.sqrt(w2_2) / (2 * Math.PI));

