"""
Auth Routes - Signup, Login, OIDC, Token Refresh
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.models import User
from apps.api.security import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    decode_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter()


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

class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """User registration"""
    existing = db.query(User).filter(User.email == request.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=request.email.lower(),
        handle=request.handle or request.email.split("@")[0],
        password_hash=get_password_hash(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created", "email": user.email, "id": user.id}


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Email/password login"""
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(user.id, claims={"email": user.email})
    refresh_token = create_refresh_token(user.id, claims={"email": user.email})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token"""
    token_payload = decode_token(request.refresh_token)
    user = db.query(User).filter(User.id == token_payload.sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    access_token = create_access_token(user.id, claims={"email": user.email})
    return TokenResponse(
        access_token=access_token,
        refresh_token=request.refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "handle": current_user.handle,
        "plan": current_user.plan,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }

