/* JHora-convention oracle: drives JHora's own swedll32.dll (SE 2.02.01) the way
 * JHora 8.0 does (JHORA_ANALYSIS.md §5.3, §7.1, §7.2):
 *   ET = UT + swe_deltat(UT)
 *   swe_set_sid_mode(SE_SIDM_LAHIRI,0,0); swe_calc(ET, ipl, SWIEPH|TRUEPOS|SIDEREAL)
 *   star correction: Spica forced to 180 deg sidereal (same flags)
 *   ayanamsa = swe_get_ayanamsa(ET) + (lambda_spica_sid - 180)
 *   houses: swe_houses(UT, lat, lon, hsys) tropical, minus ayanamsa
 * stdin: jd_ut lat lon ; stdout one line per case. */
#include <windows.h>
#include <stdio.h>
typedef double (__stdcall *f_dt)(double);
typedef int (__stdcall *f_calc)(double,int,int,double*,char*);
typedef void (__stdcall *f_path)(char*);
typedef void (__stdcall *f_sid)(int,double,double);
typedef double (__stdcall *f_aya)(double);
typedef int (__stdcall *f_hs)(double,double,double,int,double*,double*);
typedef int (__stdcall *f_fs)(char*,double,int,double*,char*);
typedef char* (__stdcall *f_ver)(char*);
static double m360(double x){ while(x<0)x+=360; while(x>=360)x-=360; return x; }
int main(int argc,char**argv){
  HMODULE h=LoadLibraryA("swedll32.dll"); if(!h){printf("noload\n");return 1;}
  f_dt dt=(f_dt)GetProcAddress(h,"_swe_deltat@8");
  f_calc calc=(f_calc)GetProcAddress(h,"_swe_calc@24");
  f_path path=(f_path)GetProcAddress(h,"_swe_set_ephe_path@4");
  f_sid sid=(f_sid)GetProcAddress(h,"_swe_set_sid_mode@20");
  f_aya aya=(f_aya)GetProcAddress(h,"_swe_get_ayanamsa@8");
  f_hs hs=(f_hs)GetProcAddress(h,"_swe_houses@36");
  f_fs fs=(f_fs)GetProcAddress(h,"_swe_fixstar@24");
  f_ver ver=(f_ver)GetProcAddress(h,"_swe_version@4");
  if(!dt||!calc||!path||!sid||!aya||!hs||!fs||!ver){printf("noproc\n");return 1;}
  char vb[256]; ver(vb); fprintf(stderr,"version %s\n",vb);
  path(argv[1]); sid(1,0,0);
  /* Sun Moon Mercury Venus Mars Jupiter Saturn MeanNode TrueNode */
  int bodies[9]={0,1,2,3,4,5,6,10,11};
  double jd,lat,lon; char err[256]; double xx[6];
  int fl=2|16|256|65536; /* SWIEPH|TRUEPOS|SPEED|SIDEREAL */
  while(scanf("%lf %lf %lf",&jd,&lat,&lon)==3){
    double d=dt(jd), et=jd+d;
    char st[64]="Spica"; err[0]=0;
    if(fs(st,et,fl,xx,err)<0) fprintf(stderr,"fixstar err %s\n",err);
    double corr=xx[0]-180.0;  /* lambda_spica_sid - 180 */
    double ay=aya(et)+corr;
    printf("%.10f %.6f %.12f",jd,d*86400.0,ay);
    for(int i=0;i<9;i++){ err[0]=0; int r=calc(et,bodies[i],fl,xx,err); if(r<0) fprintf(stderr,"calc err %d %s\n",bodies[i],err); printf(" %.12f",m360(xx[0]-corr)); }
    const char hsys[4]={'W','E','P','O'};
    for(int k=0;k<4;k++){ double c[13],a[10]; int r=hs(jd,lat,lon,hsys[k],c,a);
      printf(" %d %.12f %.12f",r,m360(a[0]-ay),m360(a[1]-ay)); for(int j=1;j<=12;j++) printf(" %.12f",m360(c[j]-ay)); }
    printf("\n"); fflush(stdout);
  }
  return 0;
}
