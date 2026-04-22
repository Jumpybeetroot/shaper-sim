import math

def get_mzv_shaper(f0, damping):
    A1 = 0.25
    A2 = 0.5
    A3 = 0.25
    t1 = 0
    t2 = 0.5 / f0
    t3 = 1.0 / f0
    return [A1, A2, A3], [t1, t2, t3]

def generate_psd(center_freq, freqs, twist):
    base_amplitude = 1e5
    damping_ratio = 0.1
    Q = 1.0 / (2.0 * damping_ratio)
    w = center_freq / Q
    
    psd = []
    for f in freqs:
        val = base_amplitude / (1.0 + math.pow((f - center_freq) / w, 2.0))
        if twist > 0:
            twist_freq = center_freq * 1.6
            twist_amp = base_amplitude * (twist / 100.0) * 0.8
            twist_w = twist_freq / (Q * 1.5)
            val += twist_amp / (1.0 + math.pow((f - twist_freq) / twist_w, 2.0))
        psd.append(val)
    return psd

def get_shaper_response(A, T, freqs):
    inv_D = 1.0 / sum(A)
    resp = []
    for f in freqs:
        sum_cos = 0
        sum_sin = 0
        omega = 2.0 * math.pi * f
        for i in range(len(A)):
            sum_cos += A[i] * math.cos(omega * T[i])
            sum_sin += A[i] * math.sin(omega * T[i])
        mag = inv_D * math.sqrt(sum_cos*sum_cos + sum_sin*sum_sin)
        resp.append(mag * mag)
    return resp

def calc_vib(psd, resp):
    sum_raw = sum(psd)
    sum_shaped = sum([psd[i] * resp[i] for i in range(len(psd))])
    return (sum_shaped / sum_raw) * 100

freqs = [f/2.0 for f in range(2, 200)]
psd_0 = generate_psd(50, freqs, 0)
psd_100 = generate_psd(50, freqs, 100)

A, T = get_mzv_shaper(50, 0.1)
resp = get_shaper_response(A, T, freqs)

print("Vib 0:", calc_vib(psd_0, resp))
print("Vib 100:", calc_vib(psd_100, resp))
