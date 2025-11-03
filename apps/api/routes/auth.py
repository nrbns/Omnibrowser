"""
Auth Routes - Signup, Login, OIDC, Token Refresh
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import jwt
from datetime import datetime, timedelta

router = APIRouter()

# Mock user store (replace with database)
users_db: dict[str, dict] = {}
SECRET_KEY = "your-secret-key-change-in-production"  # Use env var

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    handle: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

@router.post("/signup")
async def signup(request: SignupRequest):
    """User registration"""
    if request.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # TODO: Hash password, store in database
    users_db[request.email] = {
        "email": request.email,
        "handle": request.handle or request.email.split("@")[0],
        "password_hash": request.password,  # Hash this!
        "created_at": datetime.utcnow().isoformat(),
    }
    
    return {"message": "User created", "email": request.email}

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Email/password login"""
    user = users_db.get(request.email)
    if not user or user["password_hash"] != request.password:  # Compare hashed
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT tokens
    access_token = create_access_token({"sub": request.email})
    refresh_token = create_refresh_token({"sub": request.email})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=3600,
    )

@router.post("/login/oidc")
async def login_oidc(provider: str, code: str):
    """OIDC login (Google, GitHub, etc.)"""
    # TODO: Implement OIDC flow
    raise HTTPException(status_code=501, detail="OIDC not implemented yet")

@router.post("/login/otp")
async def login_otp(phone: str):
    """Phone OTP login"""
    # TODO: Send OTP, verify
    raise HTTPException(status_code=501, detail="OTP not implemented yet")

@router.post("/token/refresh")
async def refresh_token(refresh_token: str):
    """Refresh access token"""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        
        new_access_token = create_access_token({"sub": email})
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,
            expires_in=3600,
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=1)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def create_refresh_token(data: dict):
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode = data.copy()
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

